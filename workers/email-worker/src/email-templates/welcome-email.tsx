import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  firstName?: string;
}

export const WelcomeEmail = ({
  firstName = 'Creator',
}: WelcomeEmailProps) => {
  const previewText = `Welcome to Creator's Handbook Premium! Your access is now active.`;

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
                <Heading style={h1}>🎉 Welcome to Premium Access!</Heading>
              </Column>
            </Row>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            
            <Section style={successBox}>
              <Text style={successTitle}>✅ Access Granted!</Text>
              <Text style={successText}>
                You now have full access to all 28 chapters of the Creator's Handbook.
              </Text>
            </Section>

            <Text style={paragraph}>
              <strong>What you get with premium access:</strong>
            </Text>

            <Section style={featuresList}>
              <Text style={featureItem}>📚 Complete access to all premium chapters</Text>
              <Text style={featureItem}>🚀 Advanced strategies and business-building techniques</Text>
              <Text style={featureItem}>📄 Downloadable resources and templates</Text>
              <Text style={featureItem}>🔄 Lifetime access to updates</Text>
              <Text style={featureItem}>💡 Exclusive insights from successful creators</Text>
            </Section>

            <Text style={paragraph}>
              Ready to dive in? Your handbook is waiting for you!
            </Text>

            <Section style={ctaSection}>
              <Button style={button} href="https://creators-handbook-frontend.tdadelaja.workers.dev">
                Start Reading Now
              </Button>
            </Section>

            <Section style={tipsSection}>
              <Text style={tipsTitle}>💡 Pro Tips to Get Started:</Text>
              <Text style={tipItem}>• Start with Chapter 8 - "Building Your Creator Foundation"</Text>
              <Text style={tipItem}>• Download the templates in Chapter 15</Text>
              <Text style={tipItem}>• Join our community discussions (coming soon!)</Text>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Happy creating!<br />
              <strong>The Creator's Handbook Team</strong>
            </Text>
            
            <Text style={socialText}>
              Follow us for more creator tips:
            </Text>
            
            <Section style={socialLinks}>
              <Link style={socialLink} href="#">Twitter</Link>
              <Text style={socialSeparator}>•</Text>
              <Link style={socialLink} href="#">LinkedIn</Link>
              <Text style={socialSeparator}>•</Text>
              <Link style={socialLink} href="#">YouTube</Link>
            </Section>
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
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#ffffff',
};

const h1 = {
  color: '#ffffff',
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

const successBox = {
  backgroundColor: '#f0fff4',
  border: '2px solid #22d172',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '24px 0',
};

const successTitle = {
  color: '#22d172',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const successText = {
  color: '#2d3748',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0',
};

const featuresList = {
  margin: '24px 0',
  backgroundColor: '#f8f9fa',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const featureItem = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.8',
  margin: '8px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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

const tipsSection = {
  backgroundColor: '#fff5f5',
  border: '1px solid #fed7d7',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const tipsTitle = {
  color: '#c53030',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const tipItem = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '6px 0',
};

const footer = {
  padding: '24px',
  borderTop: '1px solid #e2e8f0',
  marginTop: '32px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 0',
};

const socialText = {
  color: '#a0aec0',
  fontSize: '14px',
  margin: '16px 0 8px 0',
};

const socialLinks = {
  textAlign: 'center' as const,
  margin: '8px 0',
};

const socialLink = {
  color: '#667eea',
  fontSize: '14px',
  textDecoration: 'none',
  margin: '0 8px',
};

const socialSeparator = {
  color: '#a0aec0',
  fontSize: '14px',
  margin: '0 4px',
};

export default WelcomeEmail;
