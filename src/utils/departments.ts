export interface DefaultChurchDepartment {
  name: string;
  code: string;
  description: string;
  leadName?: string;
}

export const CENTRAL_CHURCH_DEPARTMENTS: DefaultChurchDepartment[] = [
  {
    name: "Media Army",
    code: "MEDIA",
    description: "Audio-visual production, livestream, sound engineering, and media coverage.",
    leadName: "Media Lead",
  },
  {
    name: "Protocol",
    code: "PROT",
    description: "General protocol, service orderliness, guest reception, and entrance check-in.",
    leadName: "Protocol Lead",
  },
  {
    name: "Pastors' Protocol",
    code: "PAST-P",
    description: "Pastoral care, ministerial assistance, and executive protocol.",
    leadName: "Pastoral Protocol Lead",
  },
  {
    name: "Streams of Life",
    code: "SOL",
    description: "Streams of Life worship ministry, music, and choir.",
    leadName: "Music Director",
  },
  {
    name: "Prayer Unit",
    code: "PRAY",
    description: "Intercession, pre-service prayer coordinators, and prayer chains.",
    leadName: "Prayer Secretary",
  },
  {
    name: "Sanitation Department",
    code: "SAN",
    description: "Sanctuary upkeep, auditorium cleanliness, and facility hygiene.",
    leadName: "Sanitation Lead",
  },
  {
    name: "Follow-up Unit",
    code: "FLW",
    description: "First-timer integration, convert follow-up, and member retention.",
    leadName: "Follow-up Coordinator",
  },
  {
    name: "Children's Department",
    code: "CHLD",
    description: "Children's church teachers, coordinators, and age-grade educators.",
    leadName: "Children's Coordinator",
  },
  {
    name: "Hospitality Department",
    code: "HOSP",
    description: "Guest hospitality, minister care, refreshments, and welcoming team.",
    leadName: "Hospitality Head",
  },
  {
    name: "Welfare Department",
    code: "WELF",
    description: "Benevolence, member assistance, outreach, and community welfare.",
    leadName: "Welfare Lead",
  },
  {
    name: "Marshal Department",
    code: "MRSH",
    description: "Auditorium marshaling, security surveillance, and crowd management.",
    leadName: "Chief Marshal",
  },
  {
    name: "Maintenance Department",
    code: "MAINT",
    description: "Electrical, mechanical, structural facilities, and equipment repairs.",
    leadName: "Maintenance Lead",
  },
  {
    name: "Christos Army",
    code: "CARMY",
    description: "Christos Army evangelism, discipleship, and community outreach ministry unit.",
    leadName: "Ministry Lead",
  },
  {
    name: "Philips Company",
    code: "PHIL",
    description: "Technical partner and production engineering unit.",
    leadName: "Unit Coordinator",
  },
];

// Alias for backwards compatibility
export const DEFAULT_CHURCH_DEPARTMENTS = CENTRAL_CHURCH_DEPARTMENTS;
