import React from 'react';

const PrivacyPolicy = () => {
  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    lineHeight: '1.6',
    color: '#333',
    backgroundColor: '#fff'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '40px',
    borderBottom: '2px solid #e0e0e0',
    paddingBottom: '20px'
  };

  const titleStyle = {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '10px'
  };

  const lastUpdatedStyle = {
    fontSize: '0.9rem',
    color: '#666',
    fontStyle: 'italic'
  };

  const sectionStyle = {
    marginBottom: '30px'
  };

  const sectionTitleStyle = {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#34495e',
    marginBottom: '15px',
    borderLeft: '4px solid #3498db',
    paddingLeft: '15px'
  };

  const subsectionTitleStyle = {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: '20px',
    marginBottom: '10px'
  };

  const paragraphStyle = {
    marginBottom: '15px',
    textAlign: 'justify'
  };

  const listStyle = {
    paddingLeft: '20px',
    marginBottom: '15px'
  };

  const listItemStyle = {
    marginBottom: '8px'
  };

  const contactStyle = {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
    textAlign: 'center',
    marginTop: '40px'
  };

  const emailLinkStyle = {
    color: '#3498db',
    textDecoration: 'none',
    fontWeight: '500'
  };

  const highlightBoxStyle = {
    backgroundColor: '#e8f4fd',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #bee5eb',
    marginBottom: '20px'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Privacy Policy for Inspo AI</h1>
        <p style={lastUpdatedStyle}>Last Updated: May 27, 2025</p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>1. Introduction</h2>
        <p style={paragraphStyle}>
          Welcome to Inspo AI ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website, applications, and services (collectively, the "Service").
        </p>
        <p style={paragraphStyle}>
          Please read this Privacy Policy carefully. By using the Service, you acknowledge that you have read and understood this Privacy Policy.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>2. Information We Collect</h2>
        
        <h3 style={subsectionTitleStyle}>2.1 Personal Information</h3>
        <p style={paragraphStyle}>We may collect the following types of personal information:</p>
        <ul style={listStyle}>
          <li style={listItemStyle}><strong>Account Information:</strong> When you register for an account, we collect your name, email address, and password.</li>
          <li style={listItemStyle}><strong>Profile Information:</strong> Information you provide in your user profile, such as job title, company, or profile picture.</li>
          <li style={listItemStyle}><strong>Payment Information:</strong> When you subscribe to a paid plan, our payment processors collect billing details such as credit card information and billing address.</li>
          <li style={listItemStyle}><strong>User Content:</strong> Information you provide through the Service, including your search queries, preferences, and feedback.</li>
          <li style={listItemStyle}><strong>Communication Data:</strong> Information you provide when contacting us, including support requests, survey responses, and testimonials.</li>
        </ul>

        <h3 style={subsectionTitleStyle}>2.2 Usage Information</h3>
        <p style={paragraphStyle}>We automatically collect certain information about your interaction with the Service:</p>
        <ul style={listStyle}>
          <li style={listItemStyle}><strong>Device Information:</strong> Information about the device you use to access the Service, including device type, operating system, browser type, and device identifiers.</li>
          <li style={listItemStyle}><strong>Log Data:</strong> Information that your browser sends whenever you visit the Service, including your IP address, browser type and settings, access times, and referring website addresses.</li>
          <li style={listItemStyle}><strong>Service Usage Data:</strong> Information about how you use the Service, including features accessed, actions taken, and time spent.</li>
          <li style={listItemStyle}><strong>Cookies and Similar Technologies:</strong> Information collected through cookies, web beacons, and similar technologies. For more information about our use of these technologies, please see Section 6 of this policy.</li>
        </ul>

        <h3 style={subsectionTitleStyle}>2.3 AI-Generated Content</h3>
        <p style={paragraphStyle}>When you use our AI features to generate moodboards or other content, we collect:</p>
        <ul style={listStyle}>
          <li style={listItemStyle}><strong>Input Prompts:</strong> The text descriptions, keywords, and parameters you provide to generate content.</li>
          <li style={listItemStyle}><strong>Generated Output:</strong> The moodboards and other design elements created by our AI based on your inputs.</li>
          <li style={listItemStyle}><strong>Interaction Data:</strong> How you interact with the generated content (e.g., saving, sharing, or refining).</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>3. How We Use Your Information</h2>
        <p style={paragraphStyle}>We use your information for the following purposes:</p>
        
        <h3 style={subsectionTitleStyle}>3.1 To Provide and Maintain the Service</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Process and fulfill your requests</li>
          <li style={listItemStyle}>Create and manage your account</li>
          <li style={listItemStyle}>Process payments and maintain subscription records</li>
          <li style={listItemStyle}>Generate AI moodboards and design recommendations based on your inputs</li>
          <li style={listItemStyle}>Provide customer support and respond to your inquiries</li>
        </ul>

        <h3 style={subsectionTitleStyle}>3.2 To Improve and Personalize the Service</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Analyze usage patterns and trends</li>
          <li style={listItemStyle}>Develop new features and functionality</li>
          <li style={listItemStyle}>Personalize your experience</li>
          <li style={listItemStyle}>Improve our AI models and algorithms</li>
          <li style={listItemStyle}>Debug and fix issues</li>
        </ul>

        <h3 style={subsectionTitleStyle}>3.3 To Communicate with You</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Send administrative messages and updates about the Service</li>
          <li style={listItemStyle}>Provide information about new features or products</li>
          <li style={listItemStyle}>Respond to your comments and questions</li>
          <li style={listItemStyle}>Deliver marketing communications (with your consent where required)</li>
          <li style={listItemStyle}>Request feedback or participation in surveys</li>
        </ul>

        <h3 style={subsectionTitleStyle}>3.4 For Security and Legal Compliance</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Protect the security and integrity of the Service</li>
          <li style={listItemStyle}>Detect and prevent fraud, abuse, and security incidents</li>
          <li style={listItemStyle}>Comply with legal obligations</li>
          <li style={listItemStyle}>Enforce our <a href="https://app.inspoai.live/terms-and-conditions">Terms and Conditions</a></li>
          <li style={listItemStyle}>Establish, exercise, or defend legal claims</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>4. How We Share Your Information</h2>
        <p style={paragraphStyle}>We may share your information with the following categories of recipients:</p>
        
        <h3 style={subsectionTitleStyle}>4.1 Service Providers</h3>
        <p style={paragraphStyle}>
          We may share your information with third-party vendors, service providers, contractors, or agents who perform services on our behalf, such as:
        </p>
        <ul style={listStyle}>
          <li style={listItemStyle}>Cloud hosting and storage providers</li>
          <li style={listItemStyle}>Payment processors</li>
          <li style={listItemStyle}>Customer support tools</li>
          <li style={listItemStyle}>Analytics services</li>
          <li style={listItemStyle}>Email service providers</li>
        </ul>
        <p style={paragraphStyle}>
          These providers are only permitted to use your information to provide services to us and are required to maintain the confidentiality of your information.
        </p>

        <h3 style={subsectionTitleStyle}>4.2 Business Transfers</h3>
        <p style={paragraphStyle}>
          If we are involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of company assets, your information may be transferred as part of that transaction. We will notify you of any change in ownership or uses of your personal information.
        </p>

        <h3 style={subsectionTitleStyle}>4.3 Legal Requirements</h3>
        <p style={paragraphStyle}>
          We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).
        </p>

        <h3 style={subsectionTitleStyle}>4.4 With Your Consent</h3>
        <p style={paragraphStyle}>
          We may share your information with third parties when we have your consent to do so.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>5. Data Retention</h2>
        <p style={paragraphStyle}>
          We retain your personal information for as long as necessary to provide you with the Service and fulfill the purposes described in this Privacy Policy. We also retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
        </p>
        <p style={paragraphStyle}>When determining the appropriate retention period, we consider:</p>
        <ul style={listStyle}>
          <li style={listItemStyle}>The amount, nature, and sensitivity of the personal information</li>
          <li style={listItemStyle}>The potential risk of harm from unauthorized use or disclosure</li>
          <li style={listItemStyle}>The purposes for which we process the information and whether we can achieve those purposes through other means</li>
          <li style={listItemStyle}>Applicable legal requirements</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>6. Cookies and Similar Technologies</h2>
        <p style={paragraphStyle}>
          We use cookies and similar tracking technologies to collect information about your browsing activities and to distinguish you from other users of the Service. This helps us provide you with a good experience when you use the Service and allows us to improve it.
        </p>
        
        <h3 style={subsectionTitleStyle}>6.1 Types of Cookies We Use</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}><strong>Essential Cookies:</strong> Required for the operation of the Service. They enable core functionality such as security, network management, and account access.</li>
          <li style={listItemStyle}><strong>Analytical/Performance Cookies:</strong> Allow us to recognize and count the number of visitors and see how visitors move around the Service. This helps us improve the way the Service works.</li>
          <li style={listItemStyle}><strong>Functionality Cookies:</strong> Used to recognize you when you return to the Service. This enables us to personalize our content for you and remember your preferences.</li>
          <li style={listItemStyle}><strong>Targeting Cookies:</strong> Record your visit to the Service, the pages you have visited, and the links you have followed. We may use this information to make the Service more relevant to your interests.</li>
        </ul>

        <h3 style={subsectionTitleStyle}>6.2 Your Cookie Choices</h3>
        <p style={paragraphStyle}>
          Most web browsers allow you to control cookies through their settings preferences. However, if you limit the ability of websites to set cookies, you may worsen your overall user experience and/or lose access to certain features of the Service.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>7. Your Rights and Choices</h2>
        <p style={paragraphStyle}>Depending on your location, you may have certain rights regarding your personal information:</p>
        
        <div style={highlightBoxStyle}>
          <ul style={listStyle}>
            <li style={listItemStyle}><strong>Access and Information:</strong> You have the right to request information about the personal data we hold about you and how we process it.</li>
            <li style={listItemStyle}><strong>Correction:</strong> You have the right to have inaccurate personal data rectified or completed if it is incomplete.</li>
            <li style={listItemStyle}><strong>Deletion:</strong> In certain circumstances, you have the right to request the deletion of your personal data.</li>
            <li style={listItemStyle}><strong>Restriction:</strong> You have the right to request the restriction of processing of your personal data in certain circumstances.</li>
            <li style={listItemStyle}><strong>Data Portability:</strong> You have the right to receive your personal data in a structured, commonly used, and machine-readable format, and to transmit this data to another controller.</li>
            <li style={listItemStyle}><strong>Objection:</strong> You have the right to object to the processing of your personal data in certain circumstances.</li>
            <li style={listItemStyle}><strong>Withdraw Consent:</strong> Where we process your data based on consent, you have the right to withdraw that consent at any time.</li>
          </ul>
        </div>
        
        <p style={paragraphStyle}>
          To exercise these rights, please contact us at <a href="mailto:inspoai.live@gmail.com" style={emailLinkStyle}>inspoai.live@gmail.com</a>.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>8. Children's Privacy</h2>
        <p style={paragraphStyle}>
          The Service is not intended for children under the age of 16. We do not knowingly collect personal information from children under 16. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at <a href="mailto:inspoai.live@gmail.com" style={emailLinkStyle}>inspoai.live@gmail.com</a>.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>9. International Data Transfers</h2>
        <p style={paragraphStyle}>
          We may transfer your personal information to countries other than the one in which you reside. When we transfer personal information internationally, we take measures to ensure that it is protected and transferred in accordance with applicable data protection laws.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>10. Security</h2>
        <p style={paragraphStyle}>
          We implement appropriate technical and organizational measures to protect your personal information against unauthorized or unlawful processing, accidental loss, destruction, or damage. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>11. Third-Party Links</h2>
        <p style={paragraphStyle}>
          The Service may contain links to third-party websites, applications, or services that are not operated by us. We have no control over and assume no responsibility for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party sites you visit.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>12. Updates to This Privacy Policy</h2>
        <p style={paragraphStyle}>
          We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. The updated policy will be posted on this page with a revised "Last Updated" date. We encourage you to check this page periodically for the latest information on our privacy practices.
        </p>
      </div>

      <div style={contactStyle}>
        <h2 style={sectionTitleStyle}>13. Contact Us</h2>
        <p style={paragraphStyle}>
          If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:{' '}
          <a href="mailto:inspoai.live@gmail.com" style={emailLinkStyle}>
            inspoai.live@gmail.com
          </a>
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>14. For European Economic Area (EEA) Residents</h2>
        <p style={paragraphStyle}>If you are located in the EEA, the following additional information applies:</p>
        
        <h3 style={subsectionTitleStyle}>14.1 Legal Basis for Processing</h3>
        <p style={paragraphStyle}>We process your personal data on the following legal bases:</p>
        <ul style={listStyle}>
          <li style={listItemStyle}><strong>Performance of Contract:</strong> Processing necessary for the performance of a contract to which you are a party or to take steps at your request before entering into a contract.</li>
          <li style={listItemStyle}><strong>Legitimate Interests:</strong> Processing necessary for our legitimate interests, provided that these interests are not overridden by your data protection rights.</li>
          <li style={listItemStyle}><strong>Legal Obligation:</strong> Processing necessary for compliance with a legal obligation to which we are subject.</li>
          <li style={listItemStyle}><strong>Consent:</strong> Processing based on your consent.</li>
        </ul>

        <h3 style={subsectionTitleStyle}>14.2 Data Controller</h3>
        <p style={paragraphStyle}>
          For the purposes of EU data protection law, we are the data controller of your personal information.
        </p>

        <h3 style={subsectionTitleStyle}>14.3 Data Protection Officer</h3>
        <p style={paragraphStyle}>
          You may contact our Data Protection Officer at <a href="mailto:inspoai.live@gmail.com" style={emailLinkStyle}>inspoai.live@gmail.com</a>.
        </p>

        <h3 style={subsectionTitleStyle}>14.4 Supervisory Authority</h3>
        <p style={paragraphStyle}>
          If you are unsatisfied with our response to your data protection concerns, you have the right to lodge a complaint with your local data protection supervisory authority.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
