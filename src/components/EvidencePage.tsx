import React from 'react';

const evidenceData = {
  "reportTitle": "OC FRAUD NETWORK — OSINT INVESTIGATIVE REPORT",
  "coreCrime": "$12–13.5 million in federal COVID relief funds (CARES Act + ARPA) looted through shell nonprofits, fake meal-delivery contracts, and bribery.",
  "actors": [
    {
      "name": "Andrew Hoang Do",
      "tier": "Tier 1",
      "role": "OC Board of Supervisors, District 1",
      "status": "CONVICTED",
      "crime": "Conspiracy to commit bribery, steering $13.5M+ to VAS/H2H."
    },
    {
      "name": "Peter Anh Pham",
      "tier": "Tier 1",
      "role": "Founder/President, Viet America Society (VAS)",
      "status": "FUGITIVE",
      "crime": "Wire fraud, conspiracy, money laundering, bribery."
    },
    {
      "name": "Thanh Huong Nguyen",
      "tier": "Tier 1",
      "role": "CEO/President, Hand to Hand Relief Organization (H2H)",
      "status": "Federal charges",
      "crime": "Conspiracy to commit wire fraud, wire fraud, money laundering."
    }
  ],
  "timeline": [
    { "date": "Jun 2, 2020", "event": "Andrew Do votes to allocate $1M COVID funds to his district." },
    { "date": "Jun 10, 2020", "event": "Peter Pham creates VAS." },
    { "date": "Jul 17, 2020", "event": "H2H signs $1M CARES contract with OC." },
    { "date": "Aug 22, 2024", "event": "FBI raids Andrew Do, Rhiannon Do, and Cheri Pham home." },
    { "date": "Oct 22, 2024", "event": "Andrew Do pleads guilty; resigns." }
  ]
};

export default function EvidencePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{evidenceData.reportTitle}</h1>
      <p className="text-lg mb-6 bg-red-50 p-4 rounded border border-red-200">{evidenceData.coreCrime}</p>
      
      <h2 className="text-2xl font-semibold mb-3">Key Actors</h2>
      <div className="grid gap-4 mb-8">
        {evidenceData.actors.map((actor, index) => (
          <div key={index} className="border p-4 rounded shadow-sm">
            <h3 className="font-bold text-lg">{actor.name} ({actor.tier})</h3>
            <p><strong>Role:</strong> {actor.role}</p>
            <p><strong>Status:</strong> {actor.status}</p>
            <p><strong>Crime:</strong> {actor.crime}</p>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mb-3">Timeline</h2>
      <ul className="list-disc pl-5">
        {evidenceData.timeline.map((item, index) => (
          <li key={index} className="mb-2">
            <strong>{item.date}:</strong> {item.event}
          </li>
        ))}
      </ul>
    </div>
  );
}
