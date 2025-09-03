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

interface FollowUpDay3Props {
  firstName?: string;
}

export const FollowUpDay3Email = ({
  firstName = 'Creator',
}: FollowUpDay3Props) => {
  const previewText = `Success stories from fellow creators + exclusive community access`;

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
                <Heading style={h1}>🌟 Success Stories from Fellow Creators</Heading>
              </Column>
            </Row>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {firstName},</Text>
            
            <Text style={paragraph}>
              It's been 3 days since you unlocked the Creator's Handbook! I wanted to share some 
              inspiring success stories from fellow creators who've implemented these strategies.
            </Text>

            {/* Success Story 1 */}
            <Section style={storyBox}>
              <Text style={storyTitle}>📈 Sarah's Newsletter Growth</Text>
              <Text style={storyText}>
                "Using Chapter 12's email strategies, I grew my newsletter from 500 to 5,000 
                subscribers in just 2 months. The templates saved me hours every week!"
              </Text>
              <Text style={storyAuthor}>— Sarah K., Content Creator</Text>
            </Section>

            {/* Success Story 2 */}
            <Section style={storyBox}>
              <Text style={storyTitle}>💰 Mike's Revenue Boost</Text>
              <Text style={storyText}>
                "Chapter 18's monetization framework helped me launch my first digital product. 
                I made $10K in the first month!"
              </Text>
              <Text style={storyAuthor}>— Mike R., Course Creator</Text>
            </Section>

            <Text style={paragraph}>
              <strong>Ready to join them?</strong> Here are your next steps:
            </Text>

            <Section style={stepsList}>
              <Text style={stepItem}>✅ Complete Chapters 8-12 (Foundation Building)</Text>
              <Text style={stepItem}>✅ Download the templates from Chapter 15</Text>
              <Text style={stepItem}>✅ Join our exclusive creator community</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={button} href="https://creators-handbook-frontend.tdadelaja.workers.dev">
                Continue Reading
              </Button>
            </Section>

            {/* Community Invitation */}
            <Section style={communityBox}>
              <Text style={communityTitle}>🎯 Join Our Creator Community</Text>
              <Text style={communityText}>
                Connect with 500+ creators implementing these strategies. Share wins, 
                get feedback, and access exclusive resources.
              </Text>
              <Button style={communityButton} href="#">
                Join Community (Coming Soon!)
              </Button>
            </Section>

            <Text style={paragraph}>
              Questions? Just reply to this email - I read every message personally!
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Keep creating!<br />
              <strong>The Creator's Handbook Team</strong>
            </Text>
            
            <Text style={unsubscribeText}>
              <Link style={unsubscribeLink} href="#">Unsubscribe</Link> | 
              <Link style={unsubscribeLink} href="#">Update Preferences</Link>
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
  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  color: '#ffffff',
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
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

const storyBox = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #e2e8f0',
  borderLeft: '4px solid #f093fb',
  borderRadius: '8px',
  padding: '20px',
  margin: '16px 0',
};

const storyTitle = {
  color: '#2d3748',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const storyText = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '8px 0',
  fontStyle: 'italic',
};

const storyAuthor = {
  color: '#a0aec0',
  fontSize: '14px',
  fontWeight: '500',
  margin: '8px 0 0 0',
};

const stepsList = {
  margin: '24px 0',
  backgroundColor: '#f0fff4',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #c6f6d5',
};

const stepItem = {
  color: '#2d3748',
  fontSize: '16px',
  lineHeight: '1.8',
  margin: '8px 0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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

const communityBox = {
  backgroundColor: '#fff5f5',
  border: '2px solid #fed7d7',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  margin: '32px 0',
};

const communityTitle = {
  color: '#c53030',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const communityText = {
  color: '#2d3748',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '12px 0 20px 0',
};

const communityButton = {
  backgroundColor: '#c53030',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  border: 'none',
  cursor: 'pointer',
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

const unsubscribeText = {
  color: '#a0aec0',
  fontSize: '12px',
  margin: '16px 0',
};

const unsubscribeLink = {
  color: '#a0aec0',
  textDecoration: 'none',
  margin: '0 4px',
};

export default FollowUpDay3Email;
