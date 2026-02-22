// chatbot.js - Smart response matching

export const model = {
  generateContent: async (text) => {
    const input = text.toLowerCase();
    
    // Check complaint
    if (input.match(/complain|file|lodge|report|issue|problem/)) {
      return { response: { text: () => "To file a complaint:\n1. Go to 'My Complaints' section\n2. Click 'New Complaint'\n3. Select service type\n4. Describe your issue\n5. Attach supporting documents\n6. Submit and track status" } };
    }
    
    // Check documents
    if (input.match(/document|require|needed|submit|upload/)) {
      return { response: { text: () => "Required documents:\n• Valid ID (Citizenship/Passport)\n• Address proof\n• Birth certificate\n• Marriage certificate\n• Property deed (if applicable)" } };
    }
    
    // Check fees
    if (input.match(/fee|cost|price|charge|payment/)) {
      return { response: { text: () => "Fee Structure:\n• BPL (Below Poverty Line): FREE\n• General citizens: Rs. 50-500\n• Expedited service: +100%\n\nProof of BPL status required for fee waiver." } };
    }
    
    // Check location
    if (input.match(/location|address|office|where|place/)) {
      return { response: { text: () => "📍 CivicSewa Service Center\nKathmandu City Hall\nNew Road, Kathmandu\n\nHours: Mon-Fri 9AM-5PM\nPhone: +977-1-4200100" } };
    }
    
    // Check processing time
    if (input.match(/time|how long|duration|process|days|weeks/)) {
      return { response: { text: () => "⏱️ Processing Times:\n• Standard: 7-15 working days\n• Urgent: 2-3 working days\n• Online: Instant-24 hours" } };
    }
    
    // Check status
    if (input.match(/status|track|progress|update|check/)) {
      return { response: { text: () => "Check your status:\n1. Go to 'My Complaints'\n2. Find your complaint ID\n3. View current status\n4. See estimated completion\n\nGet SMS/Email updates" } };
    }
    
    // Check help
    if (input.match(/help|support|what|guide|menu|option/)) {
      return { response: { text: () => "I can help with:\n1. Complaints\n2. Documents\n3. Fees\n4. Location\n5. Processing Time\n\nWhat do you need?" } };
    }
    
    // Greetings (check last)
    if (input.match(/hello|hi|hey|greetings|namaste/)) {
      return { response: { text: () => "Namaste! 🙏 How can I help with civic services?" } };
    }
    
    // Default
    return { response: { text: () => "Ask me about complaints, documents, fees, location, or processing time!" } };
  }
};
