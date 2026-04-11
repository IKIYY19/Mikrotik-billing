/**
 * Integrations Table Migration
 * Stores encrypted API keys and configuration for external services
 */

const db = require('./index');

const integrationsMigration = `
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  config_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  last_tested TIMESTAMP,
  last_test_status VARCHAR(50),
  last_test_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_category CHECK (category IN ('sms', 'payment', 'messaging', 'email', 'storage', 'monitoring'))
);

CREATE INDEX IF NOT EXISTS idx_integrations_service ON integrations(service_name);
CREATE INDEX IF NOT EXISTS idx_integrations_category ON integrations(category);
CREATE INDEX IF NOT EXISTS idx_integrations_active ON integrations(is_active);

-- Insert default integration templates
INSERT INTO integrations (service_name, display_name, category, config_data) VALUES
  ('africas_talking', 'Africa''s Talking', 'sms', '{"username": "sandbox", "api_key": "", "sender_id": "MyISP"}'),
  ('mpesa', 'M-Pesa', 'payment', '{"consumer_key": "", "consumer_secret": "", "shortcode": "174379", "passkey": "", "environment": "sandbox"}'),
  ('whatsapp', 'WhatsApp Business', 'messaging', '{"access_token": "", "phone_number_id": "", "verify_token": ""}'),
  ('sendgrid', 'SendGrid', 'email', '{"api_key": "", "from_email": "", "from_name": ""}'),
  ('twilio', 'Twilio SMS', 'sms', '{"account_sid": "", "auth_token": "", "phone_number": ""}'),
  ('stripe', 'Stripe', 'payment', '{"secret_key": "", "publishable_key": "", "webhook_secret": "", "currency": "usd"}'),
  ('slack', 'Slack Notifications', 'monitoring', '{"webhook_url": "", "channel": "#alerts"}'),
  ('discord', 'Discord Webhook', 'monitoring', '{"webhook_url": ""}')
ON CONFLICT (service_name) DO NOTHING;
`;

async function runIntegrationsMigration() {
  console.log('🔧 Running integrations migration...');
  try {
    await db.query(integrationsMigration);
    console.log('✅ Integrations table created');
    return true;
  } catch (error) {
    console.error('❌ Integrations migration error:', error.message);
    return false;
  }
}

module.exports = { runIntegrationsMigration, integrationsMigration };
