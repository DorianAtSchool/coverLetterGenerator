import React, { useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import './clg.css'

const CoverLetterGenerator = () => {
  const [formData, setFormData] = useState({
    jobDescription: '',
    emphasis: '',
    name: '',
    company: '',
    role: '',
    tone: 'professional',
    stylePreference: 'modern',
    resumeFile: null,
    inspirations: '',
    keywords: '',
    addressingTo: '',
    existingCoverLetter: '',
    chatInput: '',
    appQuestion: '',
    existingAnswer: '',
    formType: 'coverLetter'
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState('');
  const [clChatMessages, setClChatMessages] = useState([]);
  const [appQChatMessages, setAppQChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [appResponse, setAppResponse] = useState('');
  const [generationType, setGenerationType] = useState('coverLetter');

  const coverLetterChange = (e) => {
    const { name, value } = e.target;
    setCoverLetter(value);
  };

  const handleResponseChange = (e) => { 
    const { name, value } = e.target;
    setAppResponse(value);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData(prev => ({
      ...prev,
      resumeFile: file
    }));
  };

  const formattedChatHistory = (chatMessages) => chatMessages.map((msg) => {
    return `${msg.sender === 'user' ? 'User' : 'LLM'}: ${msg.text}`; 
  }).join('\n');

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMessage = { sender: 'user', text: chatInput };

    const formDataToSend = new FormData();
    formDataToSend.append('file', formData.resumeFile);
    if (formData.formType === 'appPrompt') {
      formDataToSend.append('data', JSON.stringify({
        appQuestion: formData.appQuestion,
        existingAnswer: appResponse,
        name: formData.name,
        company: formData.company,
        role: formData.role,
        jobDescription: formData.jobDescription,
        emphasis: formData.emphasis,
        tone: formData.tone,
        stylePreference: formData.stylePreference,
        keywords: formData.keywords,
        inspirations: formData.inspirations,
        chat: chatInput,
        chatHistory: formattedChatHistory(appQChatMessages)
      }));
    }
    else if (formData.formType === 'coverLetter') {
      formDataToSend.append('data', JSON.stringify({
        existingCoverLetter: coverLetter,
        addressingTo: formData.addressingTo,
        name: formData.name,
        company: formData.company,
        role: formData.role,
        jobDescription: formData.jobDescription,
        emphasis: formData.emphasis,
        tone: formData.tone,
        stylePreference: formData.stylePreference,
        keywords: formData.keywords,
        inspirations: formData.inspirations,
        chat: chatInput,
        chatHistory: formattedChatHistory(clChatMessages)
      }));
    }
    try {
      if (formData.formType === 'appPrompt') {
        const response = await axios.post('http://localhost:8000/api/generate-app-response',
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
  
        if (response.data.success) {
          setAppResponse(response.data.app_response);
          setAppQChatMessages([...appQChatMessages, newMessage]);
          setChatInput('');
        }
      }
      else if (formData.formType === 'coverLetter') {
        const response = await axios.post('http://localhost:8000/api/generate-cover-letter', 
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.data.success) {
          setCoverLetter(response.data.cover_letter);
          setClChatMessages([...clChatMessages, newMessage]);
          setChatInput('');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20; // Increased margin for a cleaner layout
    const bottomMargin = 10;
    const maxLineWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin - bottomMargin;
  
    // Set initial font family and size
    doc.setFont('times'); // Times New Roman is a professional font
    let fontSize = 12; // Initial font size
    doc.setFontSize(fontSize);
  
    // Split text to fit within the page width
    let splitText = doc.splitTextToSize(coverLetter, maxLineWidth);
  
    // Calculate the height of the text with line spacing of 1.5
    let lineHeight = doc.getTextDimensions('Text').h * 2;
    let textHeight = splitText.length * lineHeight;
  
    // Adjust font size to fit the text within the page height
    while (textHeight > maxHeight && fontSize > 1) {
      fontSize -= 0.1;
      doc.setFontSize(fontSize);
      splitText = doc.splitTextToSize(coverLetter, maxLineWidth);
      lineHeight = doc.getTextDimensions('Text').h * 2;
      textHeight = splitText.length * lineHeight;
    }
  
    // Add text to the document starting from the top margin
    let y = margin;
    splitText.forEach(line => {
      if (y + lineHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    });
  
    doc.save('cover-letter.pdf');
  };

  const generateAppResponse = async (e) => {
    e.preventDefault();

    if (!formData.resumeFile || !formData.appQuestion) {
      setError('Please provide both a resume and application question.');
      return;
    }

    setIsGenerating(true);
    setError('');
    formData.formType = 'appPrompt';
    const formDataToSend = new FormData();
    formDataToSend.append('file', formData.resumeFile);
    formDataToSend.append('data', JSON.stringify({
      name: formData.name,
      company: formData.company,
      role: formData.role,
      jobDescription: formData.jobDescription,
      appQuestion: formData.appQuestion,
      emphasis: formData.emphasis,
      tone: formData.tone,
      stylePreference: formData.stylePreference,
      keywords: formData.keywords,
      inspirations: formData.inspirations
    }));

    try {
      const response = await axios.post('http://localhost:8000/api/generate-app-response',
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setAppResponse(response.data.app_response);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error generating application response:', error);
      setError(error.response?.data?.detail || 'Error generating application response. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCoverLetter = async (e) => {
    e.preventDefault();

    if (!formData.resumeFile || !formData.jobDescription) {
      setError('Please provide both a resume and job description.');
      return;
    }

    setIsGenerating(true);
    setError('');
    formData.formType = 'coverLetter';
    const formDataToSend = new FormData();
    formDataToSend.append('file', formData.resumeFile);
    formDataToSend.append('data', JSON.stringify({
      name: formData.name,
      company: formData.company,
      role: formData.role,
      jobDescription: formData.jobDescription,
      emphasis: formData.emphasis,
      tone: formData.tone,
      stylePreference: formData.stylePreference,
      keywords: formData.keywords,
      addressingTo: formData.addressingTo,
      inspirations: formData.inspirations
    }));

    try {
      const response = await axios.post('http://localhost:8000/api/generate-cover-letter', 
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setCoverLetter(response.data.cover_letter);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error generating cover letter:', error);
      setError(error.response?.data?.detail || 'Error generating cover letter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex gap-6 w-full">
        <div className=" w-1/3 bg-white p-6 rounded-lg shadow-lg mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Cover Letter Generator</h1>

          <form onSubmit={formData.formType === 'coverLetter' ? generateCoverLetter : generateAppResponse} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                name="formType"
                value={formData.formType}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="coverLetter">Cover Letter</option>
                <option value="appPrompt">Application Prompt</option>
                <option value="tailorResume">Tailor Resume</option>
              </select>
          </div>
          
            {/* Required Fields */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Required Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Upload Resume <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx"
                  className="mt-1 block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Job Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="jobDescription"
                  value={formData.jobDescription}
                  onChange={handleInputChange}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  required
                  placeholder="Paste the job description here..."
                />
              </div>
              {formData.formType === 'appPrompt' && <div>
                <label className="block text-sm font-medium text-gray-700">
                  Application Question <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="appQuestion"
                  value={formData.appQuestion}
                  onChange={handleInputChange}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  required
                  placeholder="Paste the application question here..."
                />
              </div>}
            </div>

            {/* Optional Fields - Collapsible */}
            <details className="bg-gray-50 p-4 rounded-lg">
              <summary className="text-lg font-semibold text-gray-700 cursor-pointer">
                Additional Options
              </summary>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Position Title</label>
                  <input
                      type="text"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Addressing To</label>
                  <input
                      type="text"
                      name="addressingTo"
                      value={formData.addressingTo}
                      onChange={handleInputChange}
                      placeholder="Hiring Manager's Name"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Industry Keywords</label>
                  <input
                      type="text"
                      name="keywords"
                      value={formData.keywords}
                      onChange={handleInputChange}
                      placeholder="Relevant industry keywords, separated by commas"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Key Points to Emphasize</label>
                  <textarea
                    name="emphasis"
                    value={formData.emphasis}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="List specific skills or experiences you want to highlight"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tone</label>
                  <select
                    name="tone"
                    value={formData.tone}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="enthusiastic">Enthusiastic</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Style Preference</label>
                    <select
                      name="stylePreference"
                      value={formData.stylePreference}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="modern">Modern</option>
                      <option value="traditional">Traditional</option>
                      <option value="creative">Creative</option>
                    </select>
                  </div>
              </div>
            </details>

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-md">
                {error}
              </div>
            )}

            <div className="flex justify-beginning">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : formData.formType === 'coverLetter' ? 'Generate Cover Letter': 'Generate Application Response'}
              </button>
            </div>
          </form>
        </div>

        {/* Preview Section */}
        <div className='w-2/3 bg-white p-6 rounded-lg shadow-lg'>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Generated Cover Letter</h2>
        {showPreview && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="bg-gray-50 p-6 rounded-lg whitespace-pre-wrap mb-4">
              <textarea 
                name={formData.formType}
                value={formData.formType === 'appPrompt' ? appResponse : coverLetter}
                onChange={formData.formType === 'appPrompt' ? handleResponseChange : coverLetterChange}
                rows={55}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end space-x-4">
              <button 
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Download
              </button>
            </div>
            {showPreview && (
            // chat box to interact with llm to make changes to the cover letter
            <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Chat with LLM</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-4 h-64 overflow-y-auto">
              {formData.formType === 'coverLetter' && clChatMessages.map((msg, index) => (
                <div key={index} className={`mb-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                    {msg.text}
                  </span>
                </div>
              ))}
              {formData.formType === 'appPrompt' && appQChatMessages.map((msg, index) => (
                <div key={index} className={`mb-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                    {msg.text}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="flex">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-grow rounded-l-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="Type your message..."
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Send
              </button>
            </form>
          </div>
          )}
          </div>
        )}
        {!showPreview && (
          <div className="bg-gray-50 p-6 rounded-lg shadow-lg">
            <p className="text-gray-700">Your cover letter will be displayed here once generated.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default CoverLetterGenerator;