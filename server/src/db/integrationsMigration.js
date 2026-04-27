/**
 * Integrations Table Migration
 * Stores encrypted API keys and configuration for external services
 */

const db = require('./index');

const integrationsMigration = `
-- Drop and recreate the constraint to include 'communication' category
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS valid_category;

ALTER TABLE integrations ADD CONSTRAINT valid_category 
  CHECK (category IN ('sms', 'payment', 'messaging', 'email', 'storage', 'monitoring', 'communication'));

-- Insert default integration templates
INSERT INTO integrations (service_name, display_name, category, config_data) VALUES
  ('africas_talking', 'Africa''s Talking', 'sms', '{"username": "sandbox", "api_key": "", "sender_id": "MyISP"}'),
  ('mpesa', 'M-Pesa', 'payment', '{"consumer_key": "", "consumer_secret": "", "shortcode": "174379", "passkey": "", "environment": "sandbox"}'),
  ('whatsapp', 'WhatsApp Business', 'messaging', '{"access_token": "", "phone_number_id": "", "verify_token": ""}'),
  ('sendgrid', 'SendGrid', 'email', '{"api_key": "", "from_email": "", "from_name": ""}'),
  ('twilio', 'Twilio SMS', 'sms', '{"account_sid": "", "auth_token": "", "phone_number": ""}'),
  ('stripe', 'Stripe', 'payment', '{"secret_key": "", "publishable_key": "", "webhook_secret": "", "currency": "usd"}'),
  ('slack', 'Slack Notifications', 'monitoring', '{"webhook_url": "", "channel": "#alerts"}'),
  ('discord', 'Discord Webhook', 'monitoring', '{"webhook_url": ""}'),
  ('smsleopard', 'SMSLeopard', 'sms', '{"api_key": "", "sender_id": ""}'),
  ('bulksms_kenya', 'BulkSMS Kenya', 'sms', '{"username": "", "api_key": "", "sender_id": ""}'),
  ('nexmo', 'Nexmo (Vonage)', 'sms', '{"api_key": "", "api_secret": "", "sender_id": ""}'),
  ('mailgun', 'Mailgun', 'email', '{"api_key": "", "domain": "", "from_email": "", "from_name": ""}'),
  ('aws_ses', 'AWS SES', 'email', '{"access_key_id": "", "secret_access_key": "", "region": "us-east-1", "from_email": "", "from_name": ""}'),
  ('mailchimp', 'Mailchimp', 'email', '{"api_key": "", "list_id": ""}'),
  ('telegram', 'Telegram Bot', 'communication', '{"bot_token": ""}')
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
