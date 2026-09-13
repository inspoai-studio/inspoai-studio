import React, { useState } from 'react';

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

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

  const subtitleStyle = {
    fontSize: '1.2rem',
    color: '#666',
    marginBottom: '15px'
  };

  const descriptionStyle = {
    fontSize: '1rem',
    color: '#555',
    fontStyle: 'italic'
  };

  const sectionStyle = {
    marginBottom: '40px'
  };

  const sectionTitleStyle = {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#34495e',
    marginBottom: '15px',
    borderLeft: '4px solid #3498db',
    paddingLeft: '15px'
  };

  const emailBoxStyle = {
    backgroundColor: '#f8f9fa',
    padding: '25px',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
    textAlign: 'center',
    marginBottom: '30px'
  };

  const emailLinkStyle = {
    color: '#3498db',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '1.1rem'
  };

  const responseTimeStyle = {
    fontSize: '0.9rem',
    color: '#666',
    marginTop: '10px'
  };

  const formStyle = {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const formGroupStyle = {
    marginBottom: '20px'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#2c3e50'
  };

  const requiredStyle = {
    color: '#e74c3c'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '1rem',
    transition: 'border-color 0.3s ease',
    boxSizing: 'border-box'
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '120px',
    resize: 'vertical'
  };

  const buttonStyle = {
    backgroundColor: '#3498db',
    color: 'white',
    padding: '12px 30px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    width: '100%'
  };

  const buttonHoverStyle = {
    backgroundColor: 'black'
  };

  const successMessageStyle = {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '15px',
    borderRadius: '6px',
    border: '1px solid #c3e6cb',
    marginBottom: '20px',
    textAlign: 'center'
  };

  const footerStyle = {
    backgroundColor: '#f8f9fa',
    padding: '25px',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
    textAlign: 'center',
    marginTop: '40px'
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = () => {
    // Basic validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      alert('Please fill in all required fields.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address.');
      return;
    }

    // In a real application, you would send the form data to a server
    setIsSubmitted(true);

    // Reset form after submission
    setTimeout(() => {
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setIsSubmitted(false);
    }, 3000);
  };

  const handleInputFocus = (e) => {
    e.target.style.borderColor = '#3498db';
  };

  const handleInputBlur = (e) => {
    e.target.style.borderColor = '#e0e0e0';
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Contact Us</h1>
        <h2 style={subtitleStyle}>Get in Touch with Inspo AI</h2>
        <p style={descriptionStyle}>Have questions or feedback? We'd love to hear from you!</p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Email Us Directly</h2>
        <div style={emailBoxStyle}>
          <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>
            <strong>Email:</strong>{' '}
            <a href="mailto:inspoai.live@gmail.com" style={emailLinkStyle}>
              inspoai.live@gmail.com
            </a>
          </p>
          <p style={responseTimeStyle}>
            We aim to respond to all inquiries within 24-48 hours.
          </p>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Contact Form</h2>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Use the form below to send us a message:
        </p>

        <div style={formStyle}>
          {isSubmitted && (
            <div style={successMessageStyle}>
              <strong>Thank you!</strong> Your message has been sent successfully. We'll get back to you soon!
            </div>
          )}

          <div>
            <div style={formGroupStyle}>
              <label style={labelStyle} htmlFor="name">
                Name <span style={requiredStyle}>*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                style={inputStyle}
                placeholder="Enter your full name"
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle} htmlFor="email">
                Email <span style={requiredStyle}>*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                style={inputStyle}
                placeholder="Enter your email address"
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle} htmlFor="subject">
                Subject <span style={requiredStyle}>*</span>
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                style={inputStyle}
                placeholder="Enter the subject of your message"
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle} htmlFor="message">
                Message <span style={requiredStyle}>*</span>
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                style={textareaStyle}
                placeholder="Enter your message here..."
                rows="5"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              style={buttonStyle}
              onMouseOver={(e) => e.target.style.backgroundColor = buttonHoverStyle.backgroundColor}
              onMouseOut={(e) => e.target.style.backgroundColor = buttonStyle.backgroundColor}
            >
              Submit Message
            </button>
          </div>
        </div>
      </div>

      <div style={footerStyle}>
        <p style={{ margin: '0', fontSize: '1rem', color: '#555' }}>
          Thank you for your interest in Inspo AI. We look forward to helping you unlock your creative potential with our AI-powered design tools!
        </p>
      </div>
    </div>
  );
};

export default ContactUs;