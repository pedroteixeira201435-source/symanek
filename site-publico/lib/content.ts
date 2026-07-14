// Single source of truth for the Symanek Specialized College public site.
// Content is REAL — extracted from symanekacademy.com (2026-07-14). See CONTENT-SOURCE.md.
// Do not invent programmes, fees or contacts here.

export const college = {
  name: "Symanek Specialized College",
  shortName: "Symanek",
  slogan: "Empowering Future Healthcare Professionals",
  subSlogan: "Study at Symanek — Where Dreams Take Shape",
  intro:
    "A registered vocational and healthcare training institution dedicated to equipping students with practical skills and professional knowledge in various fields.",
  location: "Extension 6, Okahandja, Namibia",
  mission:
    "To provide accessible, industry-responsive, and transformative education, training, research, and innovation that empower individuals, strengthen communities, and contribute to sustainable socio-economic development in Namibia and beyond.",
  vision:
    "To be the most celebrated educational brand in Namibia and beyond, transforming lives through quality education, training, and research-driven innovation.",
  whyChooseUs:
    "Choose Symanek Specialized College for quality, industry-focused education that combines practical training, experienced facilitators, and a supportive learning environment to prepare you for career success and lifelong growth.",
  accreditations: [
    "Registered with the Nursing Council of Namibia for Auxiliary Nursing and Care Giving programmes",
    "Registered with the NTA for Occupational Health & Safety and Office Administration Level 4",
    "Recognised with the HPCNA",
  ],
  contact: {
    phones: ["+264 85 804 5679", "+264 62 502 227"],
    emails: ["admin@symanekacademy.com", "info@symanekacademy.com"],
    address: "Extension 6, Okahandja, Namibia",
    hours: "7:00am – 6:00pm (Mon – Fri). Sat, Sun & Public Holidays: Closed",
    facebook: "https://facebook.com/Symanektrainingacademy",
    instagram: "https://instagram.com/Symanektrainingacademy",
    maps: "https://goo.gl/maps/DQ4LPE52wByQV3i29",
  },
  // TODO(pedro): CONFIRMAR dados bancários reais — usados na carta de aprovação (instrução EFT).
  // Valores abaixo são PLACEHOLDER; substituir pelos verdadeiros antes de enviar cartas a candidatos.
  bank: {
    bankName: "Bank Windhoek",
    accountName: "Symanek Specialized College",
    accountNumber: "PLACEHOLDER-0000000000",
    branchCode: "PLACEHOLDER",
    swift: "BWLINANX",
  },
} as const;

export const stats = [
  { value: "50+", label: "Programmes & short courses" },
  { value: "NTA", label: "Nationally accredited" },
  { value: "2", label: "Study modes — full-time & distance" },
  { value: "100%", label: "Practical, industry-focused" },
] as const;

export type Programme = {
  slug: string;
  name: string;
  level?: string;
  duration: string;
  fee?: number; // N$
  modes?: string;
  requirements?: string;
  description: string;
  careers?: string[];
};

export type Category = {
  slug: string;
  title: string;
  blurb: string;
  programmes: Programme[];
};

export const categories: Category[] = [
  {
    slug: "nursing-care",
    title: "Nursing & Care",
    blurb:
      "Caring professions — from auxiliary nursing to caregiving — registered with the Nursing Council of Namibia.",
    programmes: [
      {
        slug: "certificate-auxiliary-nursing-science",
        name: "Certificate in Auxiliary Nursing Science",
        duration: "Certificate",
        modes: "Full-Time, Distance Learning",
        description:
          "Prepares students to provide basic nursing care and support services under the supervision of registered nurses. Registered with the Nursing Council of Namibia.",
        careers: ["Auxiliary Nurse", "Nursing Assistant", "Care Support Worker", "Clinic Support Staff"],
      },
      {
        slug: "certificate-caregiving",
        name: "Certificate in Caregiving",
        duration: "6 Months",
        fee: 9370,
        modes: "Full-Time, Distance Learning",
        requirements: "Grade 9–12 with minimum 15 points; relevant caregiving experience may strengthen applications.",
        description:
          "Equips learners with practical skills to provide quality care and support to elderly persons, persons with disabilities and chronically ill patients. Registered with the Nursing Council of Namibia for Care Giving.",
        careers: ["Caregiver", "Home-Based Care Assistant", "Elderly Care Assistant", "Disability Support Worker", "Community Health Assistant"],
      },
    ],
  },
  {
    slug: "academic",
    title: "Academic Programmes",
    blurb:
      "Degree and certificate qualifications that build the foundation for a professional career in health and safety.",
    programmes: [
      {
        slug: "bachelor-ohse-honours-nqf8",
        name: "Bachelor of Occupational Health, Safety and Environmental Management, Honours",
        level: "NQF Level 8",
        duration: "Degree",
        description:
          "Provides advanced knowledge and professional competencies required for senior safety and environmental management roles.",
      },
      {
        slug: "bachelor-ohse-nqf7",
        name: "Bachelor of Occupational Health, Safety and Environmental Management",
        level: "NQF Level 7",
        duration: "3-year degree",
        description:
          "A comprehensive three-year degree designed to prepare graduates to manage workplace safety and environmental concerns.",
      },
    ],
  },
  {
    slug: "tvet",
    title: "TVET Programmes",
    blurb:
      "Accredited 12-month vocational qualifications, offered full-time or by distance learning.",
    programmes: [
      {
        slug: "certificate-ohs-level-4",
        name: "Certificate in Occupational Health and Safety",
        level: "Level 4",
        duration: "12 Months",
        fee: 19670,
        modes: "Full-Time (Preferred), Distance Learning",
        requirements:
          "Grade 11 or 12 with minimum 20 points. Grade 10 (old curriculum) with minimum 22 points. English with an E symbol or better.",
        description:
          "Entry-level qualification covering hazard identification, risk assessment, incident investigation, safety legislation, emergency preparedness, workplace inspections and safety management systems.",
        careers: ["Safety Officer", "Safety Representative", "HSE Assistant", "Safety Coordinator", "Compliance Assistant"],
      },
      {
        slug: "diploma-ohs-level-5",
        name: "Diploma in Occupational Health and Safety",
        level: "Level 5",
        duration: "12 Months",
        fee: 19670,
        modes: "Full-Time, Distance Learning",
        requirements: "Occupational Health and Safety Level 4 qualification.",
        description:
          "Advanced competencies in workplace safety management, compliance monitoring, occupational risk management and incident prevention. Progresses to the Bachelor in Occupational Health, Safety and Environmental Management Level 7.",
        careers: ["OHS Officer", "SHE Officer", "Risk Management Officer", "Compliance Officer", "Safety Supervisor"],
      },
      {
        slug: "certificate-mental-health-level-4",
        name: "Certificate in Mental Health Support and Psychosocial Counselling",
        level: "Level 4",
        duration: "12 Months",
        fee: 14090,
        modes: "Full-Time, Distance Learning",
        requirements:
          "Grade 11 or 12 with minimum 20 points. Grade 10 with minimum 22 points. English with an E symbol or better. Certificate in Counselling Services Level 3.",
        description:
          "Basic psychosocial support, mental health awareness, counselling assistance and community-based support services.",
        careers: ["Mental Health Support Worker", "Community Support Worker", "Counselling Assistant", "Youth Development Officer", "NGO Support Worker"],
      },
      {
        slug: "diploma-mental-health-level-5",
        name: "Diploma in Mental Health Support and Psychosocial Counselling",
        level: "Level 5",
        duration: "12 Months",
        fee: 14090,
        modes: "Full-Time, Distance Learning",
        requirements: "Mental Health Support Level 4 or Counselling Services Level 4.",
        description: "Advanced psychosocial support, counselling and mental health intervention skills.",
        careers: ["Psychosocial Counsellor", "Mental Health Practitioner Assistant", "Community Development Practitioner", "Employee Wellness Coordinator", "Youth Counsellor"],
      },
      {
        slug: "certificate-medical-office-admin-level-4",
        name: "Certificate in Medical Office Administration",
        level: "Level 4",
        duration: "12 Months",
        fee: 14090,
        modes: "Full-Time, Distance Learning",
        requirements:
          "Grade 11 or 12 with minimum 20 points in six subjects; Grade 10 (old curriculum) with minimum 22 points; English with an E symbol or better; National Vocational Certificate in Office Administration Level 3; or mature-age entry with 3+ years relevant work experience.",
        description:
          "Administrative and clerical roles in healthcare settings including hospitals, clinics, medical practices and pharmacies.",
        careers: ["Medical Office Administrator", "Medical Receptionist", "Patient Administration Clerk", "Health Records Clerk", "Hospital Front Desk Officer"],
      },
      {
        slug: "diploma-medical-office-admin-level-5",
        name: "Diploma in Medical Office Administration",
        level: "Level 5",
        duration: "12 Months",
        fee: 14090,
        modes: "Full-Time, Distance Learning",
        requirements: "Medical Office Administration Level 4, Medical Secretary Level 4, Office Administration Level 4, or equivalent NQF Level 4.",
        description: "Supervisory and management roles in healthcare administration.",
        careers: ["Medical Office Manager", "Hospital Administrator", "Practice Administrator", "Patient Services Manager", "Health Records Supervisor"],
      },
      {
        slug: "certificate-nutrition-dietetics-level-4",
        name: "Certificate in Nutrition and Dietetics",
        level: "Level 4",
        duration: "12 Months",
        fee: 14090,
        modes: "Full-Time, Distance Learning",
        requirements: "Grade 11 or 12 with minimum 20 points. Grade 10 with minimum 22 points. English with an E symbol or better. Food and Nutrition Level 3 or Community Health Level 3.",
        description: "Practical knowledge in nutrition, healthy living, food science, community nutrition and health promotion.",
        careers: ["Nutrition Assistant", "Community Nutrition Worker", "Health Promotion Assistant", "School Nutrition Assistant", "Wellness Programme Assistant"],
      },
      {
        slug: "diploma-nutrition-dietetics-level-5",
        name: "Diploma in Nutrition and Dietetics",
        level: "Level 5",
        duration: "12 Months",
        fee: 14090,
        modes: "Full-Time, Distance Learning",
        requirements: "National Vocational Certificate in Nutrition and Dietetics Level 4 or Community Health Level 4.",
        description: "Advanced nutrition assessment, diet planning, health promotion, food safety, occupational nutrition and community programmes.",
        careers: ["Nutrition Technician", "Community Nutrition Practitioner", "Workplace Wellness Coordinator", "Health Promotion Officer", "Food Service Supervisor"],
      },
    ],
  },
  {
    slug: "six-months",
    title: "Six-Month Programmes",
    blurb: "Focused half-year certificates that get you career-ready fast.",
    programmes: [
      {
        slug: "certificate-medical-secretary",
        name: "Certificate in Medical Secretary",
        duration: "6 Months",
        fee: 11020,
        modes: "Full-Time, Distance Learning",
        requirements: "Grade 9–12 with minimum 15 points; one year work experience as a Medical Secretary or Receptionist considered.",
        description: "Prepares students for administrative roles within healthcare facilities — medical terminology, office administration, patient communication and records management.",
        careers: ["Medical Secretary", "Medical Receptionist", "Clinic Administrator", "Patient Records Clerk", "Front Office Administrator"],
      },
    ],
  },
  {
    slug: "health-safety-emergency",
    title: "Health, Safety & Emergency Training",
    blurb: "Short courses (Face-to-Face / Online) that build practical, certifiable skills in days.",
    programmes: shortCourses([
      ["ohs-representative", "Occupational Health and Safety (OHS) Representative", "2 Days", 850, "Prepares participants to effectively perform the duties of an OHS Representative within the workplace."],
      ["first-aid-level-1-2", "First Aid Level 1 & 2", "3 Days", 750, "Learn lifesaving skills to provide immediate assistance during medical emergencies before professional help arrives."],
      ["fire-fighting-fire-marshal", "Fire Fighting and Fire Marshal Training", "2 Days", 750, "Gain the skills necessary to prevent fires, respond effectively to fire emergencies and safely evacuate occupants."],
      ["infection-prevention-control", "Infection Prevention and Control", "2 Days", 750, "Focuses on preventing the spread of infections within healthcare facilities, food establishments and community settings."],
      ["elderly-care-geriatric-support", "Elderly Care and Geriatric Support", "2 Days", 750, "Learn how to provide compassionate and professional care to elderly individuals in homes, healthcare facilities and communities."],
      ["home-based-palliative-care", "Home-Based and Palliative Care", "2 Days", 750, "Develop practical skills to support patients with chronic illnesses and those requiring end-of-life care."],
      ["patient-administration-reception", "Patient Administration and Reception", "2 Days", 850, "Equips participants with essential healthcare reception and patient administration skills."],
      ["medical-coding", "Medical Coding", "4 Days", 1200, "Learn the fundamentals of medical coding used in healthcare billing, records management and insurance administration."],
      ["emergency-preparedness-evacuation", "Emergency Preparedness and Evacuation", "2 Days", 850, "Prepare employees and organizations to effectively respond during emergencies and disasters."],
      ["safety-auditing-inspection", "Safety Auditing and Inspection", "2 Days", 850, "Develop the skills necessary to conduct workplace safety inspections and audits."],
      ["incident-investigation-reporting", "Incident Investigation and Reporting", "2 Days", 850, "Learn how to investigate workplace incidents and identify root causes to prevent recurrence."],
      ["hira", "Hazard Identification and Risk Assessment (HIRA)", "2 Days", 850, "One of the most important safety courses for identifying workplace hazards and reducing risks."],
      ["construction-safety", "Construction Safety", "2 Days", 850, "Provides safety knowledge specifically for construction sites and projects."],
      ["working-at-heights", "Working at Heights Safety", "2 Days", 850, "Learn safe work practices for activities conducted above ground level."],
      ["confined-space-entry", "Confined Space Entry", "2 Days", 850, "Provides critical safety procedures for entering and working within confined spaces."],
      ["she-induction", "SHE Induction Training", "2 Days", 850, "An introductory safety course designed for employees entering industrial and high-risk workplaces."],
    ]),
  },
  {
    slug: "mining-oil-gas",
    title: "Mining, Oil & Gas Short Courses",
    blurb: "Industry-specific safety and operations training for Namibia's energy and extractives sectors.",
    programmes: shortCourses([
      ["mining-safety-awareness", "Mining Safety Awareness", "2 Days", 850, "Introduces participants to health, safety and environmental practices commonly applied within mining operations."],
      ["intro-oil-gas-operations", "Introduction to Oil and Gas Operations", "2 Days", 850, "Gain foundational knowledge of the oil and gas industry, including exploration, production, transportation and safety requirements."],
      ["offshore-safety-awareness", "Offshore Safety Awareness", "2 Days", 850, "Introduces participants to safety requirements and hazards associated with offshore work environments."],
      ["hazardous-chemical-handling", "Hazardous Chemical Handling", "2 Days", 850, "Learn how to safely handle, store, transport and dispose of hazardous chemicals used in industrial operations."],
      ["permit-to-work-systems", "Permit to Work Systems", "2 Days", 850, "Introduces permit-to-work systems used to control high-risk activities and improve workplace safety."],
      ["waste-management-pollution-control", "Waste Management and Pollution Control", "2 Days", 850, "Develop practical skills for managing waste and minimizing environmental impacts in industrial settings."],
      ["basic-rigging-slinging", "Basic Rigging and Slinging", "2 Days", 850, "Introduces participants to safe lifting operations, rigging techniques and load handling procedures."],
      ["industrial-hygiene-awareness", "Industrial Hygiene Awareness", "2 Days", 850, "Learn how workplace exposures can affect employee health and how to identify, evaluate and control occupational health hazards."],
      ["lockout-tagout", "Lockout and Tagout (LOTO)", "2 Days", 850, "Teaches safe isolation procedures to prevent accidental energization of equipment during maintenance and repair."],
      ["industrial-housekeeping", "Industrial Housekeeping", "2 Days", 850, "Focuses on maintaining safe and organized workplaces to reduce accidents and improve productivity."],
      ["forklift-operator-awareness", "Forklift Operator Awareness", "3 Days", 1500, "Gain awareness of safe forklift operations, workplace hazards and operator responsibilities."],
      ["renewable-energy-green-hydrogen", "Introduction to Renewable Energy and Green Hydrogen", "2 Days", 850, "Introduces participants to Namibia's emerging renewable energy and green hydrogen industries."],
    ]),
  },
  {
    slug: "business-administration",
    title: "Business & Administration Short Courses",
    blurb: "Practical professional skills for the modern workplace.",
    programmes: shortCourses([
      ["office-administration-skills", "Office Administration Skills", "2 Days", 750, "Equips participants with essential administrative and office management skills required in modern workplaces."],
      ["receptionist-front-desk", "Receptionist and Front Desk Operations", "3 Days", 750, "Develop the professional skills needed to create positive first impressions and effectively manage front-office operations."],
      ["customer-care-service-excellence", "Customer Care and Service Excellence", "2 Days", 750, "Teaches participants how to deliver outstanding customer experiences."],
      ["records-filing-management", "Records and Filing Management", "2 Days", 750, "Learn effective methods for organizing, storing, retrieving and managing organizational records and information."],
      ["basic-hr-management", "Basic Human Resource Management", "2 Days", 750, "Introduces participants to the core functions of human resource management and employee relations."],
      ["entrepreneurship-small-business", "Entrepreneurship and Small Business Management", "3 Days", 1000, "Learn how to start, manage and grow a successful small business in today's competitive environment."],
      ["business-communication-skills", "Business Communication Skills", "2 Days", 750, "Develops effective verbal, written and interpersonal communication abilities."],
      ["supervisory-management-skills", "Supervisory Management Skills", "2 Days", 750, "Focuses on leadership, team management and operational effectiveness."],
      ["leadership-team-building", "Leadership and Team Building", "2 Days", 750, "Develop the leadership competencies needed to inspire teams, improve productivity and drive organizational success."],
      ["time-management-productivity", "Time Management and Productivity", "2 Days", 750, "Learn practical techniques for managing time effectively, improving productivity and achieving professional goals."],
      ["conflict-management-resolution", "Conflict Management and Resolution", "2 Days", 750, "Equips participants with practical strategies for managing workplace conflict and maintaining positive working relationships."],
      ["project-management-fundamentals", "Project Management Fundamentals", "4 Days", 1100, "Gain practical knowledge of project planning, implementation, monitoring and successful project delivery."],
    ]),
  },
];

function shortCourses(rows: [string, string, string, number, string][]): Programme[] {
  return rows.map(([slug, name, duration, fee, description]) => ({
    slug,
    name,
    duration,
    fee,
    modes: "Face-to-Face / Online",
    description,
  }));
}

export const allProgrammes: (Programme & { category: string; categoryTitle: string })[] =
  categories.flatMap((c) =>
    c.programmes.map((p) => ({ ...p, category: c.slug, categoryTitle: c.title }))
  );

export function categoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}

export function programmeBySlug(slug: string) {
  return allProgrammes.find((p) => p.slug === slug);
}

export function formatN(n?: number) {
  if (n == null) return "";
  return "N$ " + n.toLocaleString("en-US");
}
