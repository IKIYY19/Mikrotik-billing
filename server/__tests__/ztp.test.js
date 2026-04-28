/**
 * Zero-Touch Provisioning (ZTP) Integration Tests
 *
 * Tests the complete ZTP pipeline using the in-memory store.
 * No PostgreSQL dependency — all state lives in enrollmentMemoryStore
 * and memoryDb.
 *
 * Flow:
 *   1. Create enrollment token  (POST /api/devices/enrollment-token)
 *   2. Download bootstrap script (GET /mikrotik/enroll/bootstrap/:token)
 *   3. Simulate router enrollment:
 *        - report  (GET /mikrotik/enroll/report/:token)
 *        - iface   (GET /mikrotik/enroll/iface/:token)
 *        - addr    (GET /mikrotik/enroll/addr/:token)
 *        - done    (GET /mikrotik/enroll/done/:token)
 *   4. Discover & approve router (GET /api/devices/discovered,
 *      POST /api/devices/discovered/:id/approve)
 *   5. Provision script          (GET /mikrotik/provision/:token)
 *   6. Provision callback        (GET /mikrotik/provision/callback/:token)
 *   7. Edge cases (invalid/expired tokens, duplicate report)
 */

// ── Environment ───────────────────────────────────────────────────────────
process.env.JWT_SECRET =
  "ztp-test-jwt-secret-key-that-is-long-enough-for-testing-only-2024";
process.env.ENCRYPTION_KEY = "ztp-test-encryption-key-32-bytes-long!!";
process.env.NODE_ENV = "test";

const request = require("supertest");
const enrollmentMemoryStore = require("../src/services/enrollmentMemoryStore");
const provisionStore = require("../src/db/provisionStore");
const memoryDb = require("../src/db/memory");

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Clear all in-memory stores so each test starts with a clean slate.
 * Users are preserved across tests so we only register/login once.
 */
function clearMemoryStores() {
  enrollmentMemoryStore.tokens = [];
  enrollmentMemoryStore.discovered = [];

  const pStore = provisionStore.extendStore();
  pStore.routers = [];
  pStore.provision_logs = [];
  pStore.provision_events = [];

  const mStore = memoryDb._getStore();
  mStore.routers = [];
  // Do NOT clear users — needed for authentication
  // Do NOT clear projects/templates etc. — not relevant to ZTP
}

/**
 * Register a test user and return a JWT token.
 * Accepts 201 (created) or 409 (already exists).
 */
async function getAuthToken(app) {
  await request(app)
    .post("/api/auth/register")
    .send({
      email: "ztp-test@example.com",
      password: "ZtpPass123!",
      name: "ZTP Test User",
      role: "staff",
    })
    .catch(() => {}); // 409 is fine

  const loginRes = await request(app).post("/api/auth/login").send({
    email: "ztp-test@example.com",
    password: "ZtpPass123!",
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(
      `Login failed: ${loginRes.statusCode} – ${loginRes.body?.error || "unknown"}`,
    );
  }

  return loginRes.body.token;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Zero-Touch Provisioning Pipeline", () => {
  let app;
  let authToken;

  // Shared state filled by sequential tests
  let sharedEnrollToken;
  let sharedDiscoveredId;
  let sharedProvisionToken;
  let sharedRouterId;

  beforeAll(async () => {
    // Use in-memory store for the entire test suite
    global.dbAvailable = false;
    // DO NOT set global.db = mock — we want getDb() to fall through to
    // memoryDb so that INSERT/UPDATE/DELETE queries actually work.

    app = require("../src/index");
    await app.ready;

    // Register + login once for all tests
    authToken = await getAuthToken(app);
  });

  afterAll(() => {
    // Cleanup if needed
  });

  beforeEach(() => {
    clearMemoryStores();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 1: Enrollment Token Creation
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 1 — Enrollment Token Creation", () => {
    test("POST /api/devices/enrollment-token returns 201 with token and bootstrap command", async () => {
      const res = await request(app)
        .post("/api/devices/enrollment-token")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toBe(201);
      expect(res.body).toMatchObject({
        success: true,
      });
      expect(res.body.enrollment).toBeDefined();
      expect(res.body.enrollment.token).toMatch(/^enroll-/);
      expect(res.body.enrollment.status).toBe("pending");
      expect(res.body.enrollment.expires_at).toBeDefined();
      expect(res.body).toHaveProperty("bootstrap_command");
      expect(res.body.bootstrap_command).toContain(res.body.enrollment.token);
      expect(res.body.bootstrap_command).toContain(
        "/mikrotik/enroll/bootstrap/",
      );

      // Save for later tests
      sharedEnrollToken = res.body.enrollment.token;
    });

    test("POST /api/devices/enrollment-token accepts custom expiry and label", async () => {
      const res = await request(app)
        .post("/api/devices/enrollment-token")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          expires_hours: 48,
          label: "Test Site A",
          notes: "Enrollment for site A",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.enrollment.token).toMatch(/^enroll-/);
      expect(res.body.enrollment.metadata).toMatchObject({
        label: "Test Site A",
        notes: "Enrollment for site A",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 2: Bootstrap Script Generation
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 2 — Bootstrap Script Generation", () => {
    let localToken;

    beforeEach(() => {
      // Create a fresh token for this sub-suite
      localToken = `enroll-${require("crypto").randomBytes(16).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token: localToken,
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    test("GET /mikrotik/enroll/bootstrap/:token returns RouterOS script", async () => {
      const res = await request(app).get(
        `/mikrotik/enroll/bootstrap/${localToken}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("# Zero-Touch Enrollment Script");
      expect(res.text).toContain(localToken);
      expect(res.text).toContain("/mikrotik/enroll/report/");
      expect(res.text).toContain("/mikrotik/enroll/iface/");
      expect(res.text).toContain("/mikrotik/enroll/addr/");
      expect(res.text).toContain("/mikrotik/enroll/done/");
    });

    test("GET /mikrotik/enroll/bootstrap/:token returns 404 for invalid token", async () => {
      const res = await request(app).get(
        "/mikrotik/enroll/bootstrap/nonexistent-token-abc",
      );

      expect(res.statusCode).toBe(404);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("ERROR");
      expect(res.text).toMatch(/invalid/i);
    });

    test("GET /mikrotik/enroll/bootstrap/:token returns 410 for expired token", async () => {
      const expiredToken = `enroll-expired-${require("crypto").randomBytes(8).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token: expiredToken,
        status: "pending",
        expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      });

      const res = await request(app).get(
        `/mikrotik/enroll/bootstrap/${expiredToken}`,
      );

      expect(res.statusCode).toBe(410);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("ERROR");
      expect(res.text).toMatch(/expired/i);
    });

    test("GET /mikrotik/enroll/bootstrap/:token returns 410 for approved/expired status token", async () => {
      const usedToken = `enroll-used-${require("crypto").randomBytes(8).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token: usedToken,
        status: "expired", // marked as expired explicitly
        expires_at: new Date(Date.now() + 86400000).toISOString(), // not expired by time
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const res = await request(app).get(
        `/mikrotik/enroll/bootstrap/${usedToken}`,
      );

      expect(res.statusCode).toBe(410);
      expect(res.text).toContain("ERROR");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 3: Full Enrollment Flow (report + iface + addr + done)
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 3 — Full Enrollment Flow", () => {
    let enrollToken;

    beforeEach(() => {
      enrollToken = `enroll-${require("crypto").randomBytes(16).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token: enrollToken,
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    test("report + iface + addr + done returns 200/text/plain for each step", async () => {
      // Step 1 — Report
      const r1 = await request(app).get(
        `/mikrotik/enroll/report/${enrollToken}?identity=TestRouter&model=RB750&version=7.14&mac=00:11:22:33:44:55`,
      );
      expect(r1.statusCode).toBe(200);
      expect(r1.headers["content-type"]).toMatch(/text\/plain/);
      expect(r1.text).toMatch(/OK/i);

      // Step 2 — Interface
      const r2 = await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=ether1&t=ether&m=00:11:22:33:44:55&r=true&d=false`,
      );
      expect(r2.statusCode).toBe(200);
      expect(r2.headers["content-type"]).toMatch(/text\/plain/);
      expect(r2.text).toMatch(/OK/i);

      // Step 3 — Address
      const r3 = await request(app).get(
        `/mikrotik/enroll/addr/${enrollToken}?addr=192.168.88.1/24&iface=bridge1`,
      );
      expect(r3.statusCode).toBe(200);
      expect(r3.headers["content-type"]).toMatch(/text\/plain/);
      expect(r3.text).toMatch(/OK/i);

      // Step 4 — Done
      const r4 = await request(app).get(`/mikrotik/enroll/done/${enrollToken}`);
      expect(r4.statusCode).toBe(200);
      expect(r4.headers["content-type"]).toMatch(/text\/plain/);
      expect(r4.text).toMatch(/OK/i);
    });

    test("enrollment data is stored correctly in the in-memory store", async () => {
      // Run full enrollment
      await request(app).get(
        `/mikrotik/enroll/report/${enrollToken}?identity=StoreCheck&model=CCR1009&version=7.13&mac=AA:BB:CC:DD:EE:FF`,
      );
      await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=ether1&t=ether&m=AA:BB:CC:DD:EE:FF&r=true&d=false`,
      );
      await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=sfp1&t=sfp&m=AA:BB:CC:DD:EE:01&r=false&d=false`,
      );
      await request(app).get(
        `/mikrotik/enroll/addr/${enrollToken}?addr=192.168.88.1/24&iface=bridge1`,
      );
      await request(app).get(`/mikrotik/enroll/done/${enrollToken}`);

      // Verify discovered record
      const discovered = enrollmentMemoryStore.discovered.find(
        (d) => d.enrollment_token === enrollToken,
      );
      expect(discovered).toBeDefined();
      expect(discovered.identity).toBe("StoreCheck");
      expect(discovered.model).toBe("CCR1009");
      expect(discovered.primary_mac).toBe("AA:BB:CC:DD:EE:FF");
      expect(discovered.status).toBe("discovered");
      expect(Array.isArray(discovered.interfaces)).toBe(true);
      expect(discovered.interfaces.length).toBe(2);
      expect(discovered.ip_addresses.length).toBe(1);
      expect(discovered.ip_addresses[0].address).toBe("192.168.88.1/24");

      // Running ether1 should be auto-suggested as WAN
      expect(discovered.suggested_wan_interface).toBe("ether1");
      expect(Array.isArray(discovered.suggested_lan_ports)).toBe(true);
    });

    test("duplicate report updates existing record instead of creating duplicate", async () => {
      // First report
      await request(app).get(
        `/mikrotik/enroll/report/${enrollToken}?identity=FirstIdentity&model=RB750&version=7.14&mac=00:11:22:33:44:55`,
      );

      expect(enrollmentMemoryStore.discovered.length).toBe(1);

      // Second report with different identity — should UPDATE the same record
      await request(app).get(
        `/mikrotik/enroll/report/${enrollToken}?identity=UpdatedIdentity&model=RB750G&version=7.15&mac=00:11:22:33:44:55`,
      );

      expect(enrollmentMemoryStore.discovered.length).toBe(1);
      expect(enrollmentMemoryStore.discovered[0].identity).toBe(
        "UpdatedIdentity",
      );
      expect(enrollmentMemoryStore.discovered[0].model).toBe("RB750G");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 4: Router Discovery and Approval
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 4 — Router Discovery and Approval", () => {
    let enrollToken;

    beforeEach(async () => {
      // Create an enrollment token via the API so it has a valid created_by
      const tokenRes = await request(app)
        .post("/api/devices/enrollment-token")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      enrollToken = tokenRes.body.enrollment.token;

      // Simulate full enrollment
      await request(app).get(
        `/mikrotik/enroll/report/${enrollToken}?identity=DiscoveryRouter&model=RB951&version=7.13&mac=11:22:33:44:55:66`,
      );
      await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=ether1&t=ether&m=11:22:33:44:55:66&r=true&d=false`,
      );
      await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=ether2&t=ether&m=11:22:33:44:55:67&r=true&d=false`,
      );
      await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=ether3&t=ether&m=11:22:33:44:55:68&r=true&d=false`,
      );
      await request(app).get(
        `/mikrotik/enroll/iface/${enrollToken}?n=ether4&t=ether&m=11:22:33:44:55:69&r=true&d=false`,
      );
      await request(app).get(
        `/mikrotik/enroll/addr/${enrollToken}?addr=10.0.0.1/24&iface=bridge1`,
      );
      await request(app).get(`/mikrotik/enroll/done/${enrollToken}`);
    });

    test("GET /api/devices/discovered lists the enrolled router", async () => {
      const res = await request(app)
        .get("/api/devices/discovered")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const router = res.body.find((d) => d.identity === "DiscoveryRouter");
      expect(router).toBeDefined();
      expect(router.model).toBe("RB951");
      expect(router.status).toBe("discovered");
      expect(router).toHaveProperty("suggested_wan_interface");

      // Save for approval test
      sharedDiscoveredId = router.id;
    });

    test("POST /api/devices/discovered/:id/approve creates a router record with provision_token", async () => {
      // Make sure we have the discovered ID
      const listRes = await request(app)
        .get("/api/devices/discovered")
        .set("Authorization", `Bearer ${authToken}`);
      const discovered = listRes.body.find(
        (d) => d.identity === "DiscoveryRouter",
      );
      expect(discovered).toBeDefined();

      const approveRes = await request(app)
        .post(`/api/devices/discovered/${discovered.id}/approve`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "My Approved Router",
          wan_interface: "ether1",
          lan_interface: "bridge1",
        });

      expect(approveRes.statusCode).toBe(201);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body).toHaveProperty("provision_token");
      expect(approveRes.body.provision_token).toMatch(/^prov-/);
      expect(approveRes.body.router).toHaveProperty("id");
      expect(approveRes.body.router.name).toBe("My Approved Router");
      expect(approveRes.body.router.provision_status).toBe("pending");

      // Verify the router is in memoryDb
      const store = memoryDb._getStore();
      const router = store.routers.find(
        (r) => r.provision_token === approveRes.body.provision_token,
      );
      expect(router).toBeDefined();
      expect(router.provision_status).toBe("pending");

      // Save shared state
      sharedProvisionToken = approveRes.body.provision_token;
      sharedRouterId = approveRes.body.router.id;
    });

    test("POST /api/devices/discovered/:id/approve returns 404 for unknown id", async () => {
      const res = await request(app)
        .post("/api/devices/discovered/nonexistent-id/approve")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 5: Provision Script Generation
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 5 — Provision Script Generation", () => {
    // Set up a router in the in-memory store to test against
    beforeEach(() => {
      const pToken = `prov-${require("crypto").randomBytes(16).toString("hex")}`;
      const rId = `router-${require("crypto").randomBytes(8).toString("hex")}`;

      const store = memoryDb._getStore();
      store.routers.push({
        id: rId,
        project_id: null,
        name: "Provision Test Router",
        identity: "ProvisionTest",
        model: "RB750",
        mac_address: "00:11:22:33:44:55",
        ip_address: "192.168.88.1",
        wan_interface: "ether1",
        lan_interface: "bridge1",
        lan_ports: ["ether2", "ether3", "ether4", "ether5"],
        provision_token: pToken,
        provision_status: "pending",
        last_provisioned_at: null,
        provision_attempts: 0,
        dns_servers: ["8.8.8.8", "8.8.4.4"],
        ntp_servers: ["pool.ntp.org"],
        radius_server: "",
        radius_secret: "",
        radius_port: 1812,
        hotspot_enabled: false,
        pppoe_enabled: false,
        pppoe_interface: "",
        pppoe_service_name: "",
        mgmt_port: 8728,
        mgmt_username: "admin",
        mgmt_password_encrypted: null,
        connection_type: "api",
        notes: "Test router for provision",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      sharedProvisionToken = pToken;
      sharedRouterId = rId;
    });

    test("GET /mikrotik/provision/:token returns RouterOS provision script", async () => {
      const res = await request(app).get(
        `/mikrotik/provision/${sharedProvisionToken}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("MikroTik Auto-Provisioning Script");
      expect(res.text).toContain("ProvisionTest");
      expect(res.text).toContain("ether1"); // WAN interface
      expect(res.text).toContain("bridge1"); // LAN bridge
    });

    test("GET /mikrotik/provision/:token returns 404 for invalid token", async () => {
      const res = await request(app).get(
        "/mikrotik/provision/nonexistent-prov-token",
      );

      expect(res.statusCode).toBe(404);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("ERROR");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 6: Provision Callback and Billing Activation (skipped)
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 6 — Provision Callback & Billing Activation (skipped)", () => {
    beforeEach(() => {
      const pToken = `prov-${require("crypto").randomBytes(16).toString("hex")}`;
      const rId = `router-${require("crypto").randomBytes(8).toString("hex")}`;

      const store = memoryDb._getStore();
      store.routers.push({
        id: rId,
        project_id: null,
        name: "Callback Test Router",
        identity: "CallbackTest",
        model: "RB750",
        mac_address: "00:11:22:33:44:55",
        ip_address: "", // Empty IP — billing activation will be skipped
        wan_interface: "ether1",
        lan_interface: "bridge1",
        lan_ports: ["ether2", "ether3", "ether4", "ether5"],
        provision_token: pToken,
        provision_status: "pending",
        last_provisioned_at: null,
        provision_attempts: 0,
        dns_servers: ["8.8.8.8", "8.8.4.4"],
        ntp_servers: ["pool.ntp.org"],
        radius_server: "",
        radius_secret: "",
        radius_port: 1812,
        hotspot_enabled: false,
        pppoe_enabled: false,
        pppoe_interface: "",
        pppoe_service_name: "",
        mgmt_port: 8728,
        mgmt_username: "",
        mgmt_password_encrypted: null,
        connection_type: "api",
        notes: "Callback test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      sharedProvisionToken = pToken;
      sharedRouterId = rId;
    });

    test("GET /mikrotik/provision/callback/:token marks router as provisioned", async () => {
      const res = await request(app).get(
        `/mikrotik/provision/callback/${sharedProvisionToken}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("OK");
      expect(res.text).toContain("Router marked as provisioned");

      // Verify the router status changed in memoryDb
      const store = memoryDb._getStore();
      const router = store.routers.find(
        (r) => r.provision_token === sharedProvisionToken,
      );
      expect(router).toBeDefined();
      expect(router.provision_status).toBe("provisioned");
      expect(router.last_provisioned_at).toBeDefined();
    });

    test("GET /mikrotik/provision/callback/:token handles billing activation without crashing (no credentials)", async () => {
      const res = await request(app).get(
        `/mikrotik/provision/callback/${sharedProvisionToken}`,
      );

      expect(res.statusCode).toBe(200);
      // Should mention billing was skipped (capitalised in response)
      expect(res.text).toMatch(/billing/i);
      expect(res.text).toMatch(/skip/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  Test 7: Edge Cases
  // ═══════════════════════════════════════════════════════════════════════
  describe("Test 7 — Edge Cases", () => {
    test("enrollment report with non-existent token returns error", async () => {
      const res = await request(app).get(
        "/mikrotik/enroll/report/nonexistent-token?identity=Ghost&model=X&version=1&mac=00:00:00:00:00:00",
      );

      expect(res.statusCode).toBe(200); // report returns 200 with error in body
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text).toContain("ERROR");
    });

    test("enrollment iface with non-existent token returns error", async () => {
      const res = await request(app).get(
        "/mikrotik/enroll/iface/nonexistent-token?n=ether1&t=ether&m=00:00:00:00:00:00&r=true&d=false",
      );

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("ERROR");
    });

    test("enrollment addr with non-existent token returns error", async () => {
      const res = await request(app).get(
        "/mikrotik/enroll/addr/nonexistent-token?addr=10.0.0.1/24&iface=bridge1",
      );

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("ERROR");
    });

    test("enrollment iface with no name returns skip", async () => {
      // First create a valid token
      const token = `enroll-${require("crypto").randomBytes(16).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token,
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Missing 'n' parameter
      const res = await request(app).get(
        `/mikrotik/enroll/iface/${token}?t=ether&m=00:00:00:00:00:00&r=true&d=false`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("SKIP");
    });

    test("enrollment addr with no address returns skip", async () => {
      const token = `enroll-${require("crypto").randomBytes(16).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token,
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const res = await request(app).get(
        `/mikrotik/enroll/addr/${token}?iface=bridge1`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("SKIP");
    });

    test("token that is already approved returns 410 on bootstrap fetch", async () => {
      const approvedToken = `enroll-approved-${require("crypto").randomBytes(8).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token: approvedToken,
        status: "approved",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        used_at: new Date().toISOString(),
        router_id: "some-router-id",
        created_by: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const res = await request(app).get(
        `/mikrotik/enroll/bootstrap/${approvedToken}`,
      );

      expect(res.statusCode).toBe(410);
      expect(res.text).toContain("ERROR");
    });

    test("expired token on report route returns error", async () => {
      const expiredToken = `enroll-expired-report-${require("crypto").randomBytes(8).toString("hex")}`;
      enrollmentMemoryStore.tokens.push({
        id: require("uuid").v4(),
        token: expiredToken,
        status: "pending",
        expires_at: new Date(Date.now() - 3600000).toISOString(),
        used_at: null,
        router_id: null,
        created_by: null,
        metadata: {},
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      });

      const res = await request(app).get(
        `/mikrotik/enroll/report/${expiredToken}?identity=Ghost&model=X&version=1&mac=00:00:00:00:00:00`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.text).toContain("ERROR");
      expect(res.text).toMatch(/expired/i);
    });
  });
});
