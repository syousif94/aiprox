import sgMail from '@sendgrid/mail';

// Replace 'YOUR_SENDGRID_API_KEY' with your actual SendGrid API key
sgMail.setApiKey(process.env.SG_KEY || '');

interface EmailData {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(emailData: EmailData): Promise<void> {
  try {
    await sgMail.send(emailData);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
