from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from openai import OpenAI
import os
from PyPDF2 import PdfReader
import docx
import json
import io
from dotenv import load_dotenv
from datetime import datetime

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenAI
load_dotenv()
client = OpenAI()

class CoverLetterRequest(BaseModel):
    name: Optional[str]
    company: Optional[str]
    role: Optional[str]
    jobDescription: str
    emphasis: Optional[str]
    tone: Optional[str]
    stylePreference: Optional[str]
    keywords: Optional[str] = None
    addressingTo: Optional[str] = None
    inspirations: Optional[str] = None
    existingCoverLetter: Optional[str] = None
    chat: Optional[str] = None
    chatHistory: Optional[str] = None

class AppQuestionRequest(BaseModel):
    name: Optional[str]
    company: Optional[str]
    role: Optional[str]
    jobDescription: str
    appQuestion: str
    emphasis: Optional[str]
    tone: Optional[str]
    stylePreference: Optional[str]
    keywords: Optional[str] = None
    inspirations: Optional[str] = None
    existingAnswer: Optional[str] = None
    chat: Optional[str] = None
    chatHistory: Optional[str] = None

def extract_text_from_pdf(file_bytes):
    """Extract text from PDF file"""
    with io.BytesIO(file_bytes) as pdf_stream:
        pdf = PdfReader(pdf_stream)
        text = ""
        for page in pdf.pages:
            text += page.extract_text()
    return text

def extract_text_from_docx(file_bytes):
    """Extract text from DOCX file"""
    doc = docx.Document(file_bytes)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text

def create_cover_letter_prompt(data: CoverLetterRequest, resume_text: str) -> str:
    """Create a detailed prompt for the OpenAI API"""
    # Get today's date
    today_date = datetime.today().strftime('%B %d, %Y')
    prompt = f"""Please write a compelling and convincing cover letter with the following requirements:

        CANDIDATE INFORMATION:
        - Name: {data.name}
        - Resume: {resume_text}  

        JOB DETAILS:
        - Company: {data.company}
        - Job Description: {data.jobDescription}
        - Role: {data.role}

        KEY POINTS TO EMPHASIZE:
        {data.emphasis}

        STYLE REQUIREMENTS:
        - Tone: {data.tone}
        - Style: {data.stylePreference}
        - Addressing to: {data.addressingTo if data.addressingTo else "Hiring Manager"}

        ADDITIONAL CONTEXT:
        - Keywords to include: {data.keywords if data.keywords else "None specified"}
        - Date: {today_date}

        Existing Cover Letter:
        {data.existingCoverLetter if data.existingCoverLetter else "None provided"}

        Request History:
        {data.chatHistory if data.chatHistory else "None provided"}

        Task:
        {f"Modify the existing cover letter according to the following requests: {data.chat}. Make sure to adhere to previous requests as well, unless the current request overrides an existing one. Do not modify anything else. If the request is already accounted for, ignore it." if data.existingCoverLetter else f"Write a compelling cover letter for the candidate applying for the {data.role} position at {data.company}. The cover letter should highlight the candidate's relevant experience, skills, and achievements that align with the job requirements. Emphasize the candidate's value proposition and cultural fit with the company. Make sure to follow the company's style and tone preferences, and include any specified keywords. End the cover letter with a strong call to action."}
       
        WRITING GUIDELINES:
        1. Format as a proper business letter with date and candidate's contact information
        2. Keep the letter concise and impactful, spanning a single page (around 500 words)
        3. Make specific connections between the candidate's experience and job requirements, if appropriate
        4. Use a {data.tone} tone throughout
        5. Follow {data.stylePreference} style conventions
        6. Include keywords naturally where appropriate
        7. Focus on value proposition and cultural fit
        8. End with a strong call to action
        9. Proofread for grammar and spelling errors
        10. Do not output anything other than the cover letter
        11. Do not include any information that is not relevant to the job application
        12. Write as if you are the candidate
        13. Do not say things like "as advertised in your job posting"
        14. Do not include the company's address or contact information, unless provided
        15. Do not include any personal or contact information, unless provided
        16. Include social media links if provided, such as LinkedIn, GitHub, or personal website
        17. Do not make things up, such as fake experiences or skills
        18. Do not make unreasonable connections between the candidate's experience and job requirements
        19. Paragraphs should be logically structured and flow smoothly
        20. Do not include empty lines or extra spaces between paragraphs
        21. Each new paragraph should be indented
        
        If provided, draw inspiration from these example letters while maintaining originality:
        {data.inspirations if data.inspirations else "No examples provided"}"""

    return prompt

def create_app_question_prompt(data: AppQuestionRequest, resume_text: str) -> str:
    """Create a detailed prompt for the OpenAI API"""
    # Get today's date
    prompt = f"""Please write a detailed and informative response to the following question:

        CANDIDATE INFORMATION:
        - Name: {data.name}
        - Resume: {resume_text}  

        QUESTION DETAILS:
        - Company: {data.company}
        - Role: {data.role}
        - Question(s): {data.appQuestion}

        KEY POINTS TO EMPHASIZE:
        {data.emphasis}

        STYLE REQUIREMENTS:
        - Tone: {data.tone}
        - Style: {data.stylePreference}

        ADDITIONAL CONTEXT:
        - Keywords to include: {data.keywords if data.keywords else "None specified"}

        Existing Answer:
        {data.existingAnswer if data.existingAnswer else "None provided"}

        Request History:
        {data.chatHistory if data.chatHistory else "None provided"}

        Task:
        {f"Modify the existing answer according to the following requests: {data.chat}. Make sure to adhere to previous requests as well, unless the current request overrides an existing one. Do not modify anything else. If the request is already accounted for, ignore it." if data.existingAnswer else f"Write a detailed response to the question asked on a job application for the {data.role} position at {data.company}. The response should be informative, concise, and tailored to the question. Emphasize the candidate's relevant experience, skills, and achievements that align with the question requirements. Make sure to follow the company's style and tone preferences, and include any specified keywords."}
       
        WRITING GUIDELINES:
        1. If multiple questions are asked, address each question separately
        2. Keep the response(s) concise and impactful, spanning a single paragraph unless otherwise specified
        3. Make specific connections between the candidate's experience and question requirements, if appropriate
        4. Use a {data.tone} tone throughout
        5. Follow {data.stylePreference} style conventions
        6. Include keywords naturally where appropriate
        7. Focus on relevant experience, skills, and achievements
        8. Proofread for grammar and spelling errors
        9. Do not output anything other than the response
        10. Do not include any information that is not relevant to the question
        11. Write as if you are the candidate
        12. Do not include any personal or contact information

        If provided, draw inspiration from these examples while maintaining originality:
        {data.inspirations if data.inspirations else "No examples provided"}"""
    
    return prompt



@app.post("/api/generate-cover-letter")
async def generate_cover_letter(
    file: UploadFile = File(...),
    data: str = Form(...)
):
    try:
        # Parse the JSON string back into a dictionary
        form_data = json.loads(data)
        
        # Convert form data to pydantic model
        cover_letter_request = CoverLetterRequest(**form_data)
        
        # Read and process resume file
        file_content = await file.read()
        if file.filename.endswith('.pdf'):
            resume_text = extract_text_from_pdf(file_content)
        elif file.filename.endswith(('.doc', '.docx')):
            resume_text = extract_text_from_docx(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        # Create the prompt
        prompt = create_cover_letter_prompt(cover_letter_request, resume_text)

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert cover letter writer with years of experience in HR and recruiting. Your goal is to create personalized, compelling cover letters that highlight candidates' relevant experiences and align them with job details."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1200
        )

        # Extract the generated cover letter
        cover_letter = response.choices[0].message.content

        return {
            "success": True,
            "cover_letter": cover_letter
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-app-response")
async def generate_app_response(
    file: UploadFile = File(...),
    data: str = Form(...)
):
    try:
        # Parse the JSON string back into a dictionary
        form_data = json.loads(data)
        
        # Convert form data to pydantic model
        app_question_request = AppQuestionRequest(**form_data)
        
        # Read and process resume file
        file_content = await file.read()
        if file.filename.endswith('.pdf'):
            resume_text = extract_text_from_pdf(file_content)
        elif file.filename.endswith(('.doc', '.docx')):
            resume_text = extract_text_from_docx(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        # Create the prompt
        prompt = create_app_question_prompt(app_question_request, resume_text)

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert career coach with years of experience in HR and recruiting. Your goal is to provide detailed and informative responses to job application questions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )

        # Extract the generated response
        app_response = response.choices[0].message.content

        return {
            "success": True,
            "app_response": app_response
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)