import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';

interface UnlockCodeEmailProps {
  firstName?: string;
  unlockCode: string;
  expiryHours?: number;
}

export const UnlockCodeEmail = ({
  firstName = 'Creator',
  unlockCode,
  expiryHours = 24,
}: UnlockCodeEmailProps) => {
  const previewText = `Your Creator's Handbook access code: ${unlockCode}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Row>
              <Column>
                <Heading style={h1}>🔓 Your Access Code is Ready!</Heading>
              </Column>
            </Row>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            
            <Text style={paragraph}>
              Thanks for your interest in the <strong>Creator's Handbook</strong>! 
              Here's your 6-digit access code to unlock all premium chapters:
            </Text>

            {/* Code Box */}
            <Section style={codeSection}>
              <Text style={codeText}>{unlockCode}</Text>
            </Section>

            <Text style={paragraph}>
              <strong>What's next?</strong>
            </Text>

            <Section style={stepsList}>
              <Text style={stepItem}>✅ Go back to the Creator's Handbook</Text>
              <Text style={stepItem}>✅ Enter this code when prompted</Text>
              <Text style={stepItem}>✅ Enjoy instant access to all 28 premium chapters!</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={button} href="https://creators-handbook-frontend.tdadelaja.workers.dev">
                Access Your Handbook
              </Button>
            </Section>

            <Text style={warningText}>
              ⏰ This code expires in {expiryHours} hours for security reasons.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Happy creating!<br />
              <strong>The Creator's Handbook Team</strong>
            </Text>
            
            <Text style={disclaimerText}>
              This email was sent because you requested access to premium content. 
              If you didn't request this, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 24px',
  textAlign: 'center' as const,
  backgroundColor: '#f8f9fa',
  borderBottom: '3px solid #22d172',
};

const h1 = {
  color: '#333',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1.3',
};

const content = {
  padding: '24px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  textAlign: 'left' as const,
  margin: '16px 0',
};

const codeSection = {
  backgroundColor: '#f8f9fa',
  border: '3px solid #22d172',
  borderRadius: '12px',
  padding: '32px',
  textAlign: 'center' as const,
  margin: '32px 0',
};

const codeText = {
  color: '#22d172',
  fontSize: '36px',
  fontWeight: 'bold',
  letterSpacing: '8px',
  margin: '0',
  fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
};

const stepsList = {
  margin: '24px 0',
};

const stepItem = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '8px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#22d172',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  border: 'none',
  cursor: 'pointer',
};

const warningText = {
  color: '#f56565',
  fontSize: '14px',
  fontWeight: '500',
  textAlign: 'center' as const,
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#fed7d7',
  borderRadius: '8px',
  border: '1px solid #feb2b2',
};

const footer = {
  padding: '24px',
  borderTop: '1px solid #e2e8f0',
  marginTop: '32px',
};

const footerText = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  textAlign: 'center' as const,
  margin: '16px 0',
};

const disclaimerText = {
  color: '#a0aec0',
  fontSize: '12px',
  lineHeight: '1.4',
  textAlign: 'center' as const,
  margin: '16px 0',
  fontStyle: 'italic',
};

export default UnlockCodeEmail;
