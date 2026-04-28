const { generateProvisionScript } = require("./src/db/provisionStore");

const mockRouter = {
  name: "TestRouter",
  identity: "TestRouter",
  model: "RB750Gr3",
  wan_interface: "ether1",
  lan_interface: "bridge1",
  lan_ip: "192.168.88.1/24",
  dhcp_start: "192.168.88.100",
  dhcp_end: "192.168.88.200",
  dns_servers: ["8.8.8.8", "8.8.4.4"],
  ntp_servers: ["pool.ntp.org"],
  lan_ports: ["ether2", "ether3", "ether4", "ether5"],
  hotspot_enabled: false,
  pppoe_enabled: false,
  radius_server: "",
  radius_secret: "",
  vlans: [],
  static_routes: [],
  bandwidth_control: false,
  snmp_enabled: false,
  provision_token: "prov-226bf26a04a1d5401396185545ea8605d44113fdb7aa3be5",
};

const script = generateProvisionScript(mockRouter, {
  callbackBaseUrl: "https://mikrotik-billing-kxy9.onrender.com",
});
const lines = script.split("\n");

console.log("=== GENERATED SCRIPT ===\n");
lines.forEach((line, index) => {
  const lineNum = index + 1;
  const len = line.length;
  if (len >= 150) {
    console.log(
      `${String(lineNum).padStart(4, " ")} [LEN=${len}]: ${line.substring(0, 200)}...`,
    );
  } else {
    console.log(`${String(lineNum).padStart(4, " ")} [LEN=${len}]: ${line}`);
  }
});

console.log("\n=== TOTAL LINES: " + lines.length + " ===");
console.log("\n=== LINE 219 ===");
if (lines.length >= 219) {
  console.log(`Line 219 [LEN=${lines[218].length}]: ${lines[218]}`);
} else {
  console.log(`Script only has ${lines.length} lines`);
}

console.log("\n=== LINES WITH LENGTH >= 150 ===");
lines.forEach((line, index) => {
  if (line.length >= 150) {
    console.log(
      `Line ${index + 1} [LEN=${line.length}]: ${line.substring(0, 200)}`,
    );
  }
});
