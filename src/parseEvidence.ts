import { GoogleGenAI, Type } from "@google/genai";

// This is a placeholder for the parsing logic I will execute.
// I will use the OCR text from the PDF to generate a structured JSON.

const ocrText = `OC FRAUD NETWORK — CONFIDENTIAL INVESTIGATIVE REPORT Page 1
OC FRAUD NETWORK
OSINT INVESTIGATIVE REPORT
COVID-19 Fraud • Nonprofit Shell Pipeline • Judicial Capture • Interstate Trafficking • Whistleblower
Retaliation
Orange County, California — Compiled 2026
SENSITIVE — FOR SUBMISSION TO: HUD-OIG / IRS-CI / FBI Public Corruption / MN House
Fraud Committee
Orange County COVID Fraud Network — Complete OSINT Report
Compiled: March 31, 2026
Classification: Research/Evidence Compilation
Sources: Federal indictment (8:25-CR-00100-JVS), OC Civil Complaint (ROA45), LAist investigations, CA Secretary of
State filings, public salary databases
THE CORE CRIME
$12–13.5 million in federal COVID relief funds (CARES Act + ARPA) was systematically looted through a network of shell
nonprofits, fake meal-delivery contracts, and bribery of an elected Orange County Supervisor. Not a dollar's worth of meals
was ever properly documented as delivered.
FULLY DECODED: EVERY ACTOR
■ TIER 1 — CONVICTED / INDICTED / FUGITIVE
ANDREW HOANG DO
• Role: OC Board of Supervisors, District 1 (2015–Oct 2024)
• Status: CONVICTED. Pled guilty Oct 22, 2024. Sentenced 5 years federal prison.
• Crime: Conspiracy to commit bribery. Accepted $550,000–$730,500 in bribes funneled through VAS to his daughters.
Personally edited contract terms to remove meal delivery minimums and accountability provisions. Used unilateral
"discretionary fund" authority to steer $13.5M+ to VAS and H2H without board votes or public disclosure.
• In indictment as: Named defendant (not an "Individual")
• Address: North Tustin home (District 3, not District 1 he represented — residency fraud allegations never prosecuted)`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function parseEvidence() {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Parse the following investigative report into a structured JSON format. Include sections for:
    - Title/Report Info
    - Core Crime Summary
    - Actors (categorized by Tier)
    - Key Addresses
    - Timeline of Fraud
    - Outstanding Questions
    - National Fraud Blueprint/Parallel Networks
    - Whistleblower Retaliation Timeline
    
    OCR Text: ${ocrText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reportTitle: { type: Type.STRING },
          coreCrime: { type: Type.STRING },
          actors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                tier: { type: Type.STRING },
                role: { type: Type.STRING },
                status: { type: Type.STRING },
                crime: { type: Type.STRING }
              }
            }
          },
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                event: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  console.log(response.text);
}

parseEvidence();
