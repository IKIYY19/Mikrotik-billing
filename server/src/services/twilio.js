/**
 * Twilio SMS Integration
 * Global SMS provider with Kenya coverage
 */

const twilio = require('twilio');

class TwilioService {
  constructor(config = {}) {
    this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.phoneNumber = config.phoneNumber || process.env.TWILIO_PHONE_NUMBER || '';
    
    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  async sendSMS(to, message) {
    try {
      if (!this.client) {
        return {
          success: false,
          message: 'Twilio client not initialized. Check credentials.',
        };
      }

      console.log(`Twilio: Sending SMS to ${to} from ${this.phoneNumber}`);
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to,
      });

      console.log(`Twilio: SMS sent successfully. SID: ${result.sid}, Status: ${result.status}`);
      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
      };
    } catch (error) {
      console.error('Twilio error:', error.message, error.code, error.moreInfo);
      return {
        success: false,
        message: error.message,
        errorCode: error.code,
        moreInfo: error.moreInfo,
      };
    }
  }

  async getBalance() {
    try {
      if (!this.client) {
        return {
          success: false,
          message: 'Twilio client not initialized.',
        };
      }

      const account = await this.client.api.accounts(this.accountSid).fetch();
      
      return {
        success: true,
        balance: account.balance,
        currency: account.balanceSubunits,
      };
    } catch (error) {
      console.error('Twilio balance error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getMessageStatus(messageSid) {
    try {
      if (!this.client) {
        return {
          success: false,
          message: 'Twilio client not initialized.',
        };
      }

      const message = await this.client.messages(messageSid).fetch();
      
      return {
        success: true,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      console.error('Twilio message status error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = TwilioService;
