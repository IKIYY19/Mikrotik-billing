/**
 * AWS SES API Integration
 * Amazon Simple Email Service for high-volume transactional email
 */

const AWS = require('aws-sdk');

class AwsSesService {
  constructor(config = {}) {
    this.accessKeyId = config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';
    this.fromEmail = config.fromEmail || process.env.AWS_SES_FROM_EMAIL || '';
    this.fromName = config.fromName || process.env.AWS_SES_FROM_NAME || '';

    AWS.config.update({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    });

    this.ses = new AWS.SES({ apiVersion: '2010-12-01' });
  }

  async sendEmail(to, subject, html, text = '') {
    try {
      const params = {
        Source: `${this.fromName} <${this.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            Text: text ? {
              Data: text,
              Charset: 'UTF-8',
            } : undefined,
          },
        },
      };

      const result = await this.ses.sendEmail(params).promise();

      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error) {
      console.error('AWS SES error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async sendTemplate(to, templateName, templateData = {}) {
    try {
      const params = {
        Source: `${this.fromName} <${this.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Template: templateName,
        TemplateData: JSON.stringify(templateData),
      };

      const result = await this.ses.sendTemplatedEmail(params).promise();

      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error) {
      console.error('AWS SES template error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSendQuota() {
    try {
      const result = await this.ses.getSendQuota().promise();

      return {
        success: true,
        max24HourSend: result.Max24HourSend,
        maxSendRate: result.MaxSendRate,
        sentLast24Hours: result.SentLast24Hours,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyEmail(email) {
    try {
      const params = {
        EmailAddress: email,
      };

      const result = await this.ses.verifyEmailIdentity(params).promise();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = AwsSesService;
