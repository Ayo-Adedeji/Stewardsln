import type { FormSchema, SessionType } from "@/types/attendance";

export const DEFAULT_SUNDAY_SERVICE_FORM: FormSchema = {
  fields: [
    {
      id: "full_name",
      type: "full_name",
      label: "Full Name",
      helpText: "Enter your first and last name",
      required: true,
    },
    {
      id: "department",
      type: "department",
      label: "Department",
      helpText: "Select your church service workforce unit",
      required: true,
    },
  ],
};

export const DEFAULT_WORKERS_MEETING_FORM: FormSchema = {
  fields: [
    {
      id: "full_name",
      type: "full_name",
      label: "Full Name",
      helpText: "Worker / Minister full name",
      required: true,
    },
    {
      id: "department",
      type: "department",
      label: "Department",
      helpText: "Primary ministry unit or auxiliary department",
      required: true,
    },
    {
      id: "phone_number",
      type: "phone",
      label: "Phone Number",
      helpText: "Active mobile line for ministry alerts",
      required: true,
    },
    {
      id: "leadership_role",
      type: "select",
      label: "Ministry Designation",
      helpText: "Your current worker assignment",
      required: false,
      options: [
        "Head of Department (HOD)",
        "Assistant HOD",
        "Senior Workforce Member",
        "New Worker in Training",
      ],
    },
  ],
};

export const DEFAULT_CONFERENCE_FORM: FormSchema = {
  fields: [
    {
      id: "full_name",
      type: "full_name",
      label: "Full Name",
      helpText: "Delegate full name",
      required: true,
    },
    {
      id: "phone_number",
      type: "phone",
      label: "Phone Number",
      helpText: "For event updates and materials",
      required: true,
    },
    {
      id: "email_address",
      type: "email",
      label: "Email Address",
      helpText: "Conference syllabus and access materials",
      required: true,
    },
    {
      id: "department",
      type: "department",
      label: "Department / Fellowship Unit",
      helpText: "Home branch or department unit",
      required: false,
    },
    {
      id: "first_time",
      type: "yes_no",
      label: "Is this your first time at this conference?",
      helpText: "Let us know so we can welcome you specially",
      required: false,
    },
    {
      id: "accommodation_needed",
      type: "yes_no",
      label: "Do you require church hostel accommodation?",
      helpText: "For out-of-town delegates",
      required: false,
    },
  ],
};

export const DEFAULT_GENERAL_EVENT_FORM: FormSchema = {
  fields: [
    {
      id: "full_name",
      type: "full_name",
      label: "Full Name",
      helpText: "Attendee full name",
      required: true,
    },
    {
      id: "department",
      type: "department",
      label: "Department",
      helpText: "Church department (if applicable)",
      required: false,
    },
    {
      id: "phone_number",
      type: "phone",
      label: "Phone Number",
      helpText: "Contact phone number",
      required: false,
    },
  ],
};

export const DEFAULT_CUSTOM_FORM: FormSchema = {
  fields: [
    {
      id: "full_name",
      type: "full_name",
      label: "Full Name",
      helpText: "Attendee full name",
      required: true,
    },
  ],
};

export function getFormTemplateForSessionType(type: SessionType): FormSchema {
  switch (type) {
    case "sunday_service":
      return JSON.parse(JSON.stringify(DEFAULT_SUNDAY_SERVICE_FORM));
    case "workers_meeting":
      return JSON.parse(JSON.stringify(DEFAULT_WORKERS_MEETING_FORM));
    case "conference":
      return JSON.parse(JSON.stringify(DEFAULT_CONFERENCE_FORM));
    case "general_event":
      return JSON.parse(JSON.stringify(DEFAULT_GENERAL_EVENT_FORM));
    case "custom":
      return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_FORM));
    default:
      return JSON.parse(JSON.stringify(DEFAULT_SUNDAY_SERVICE_FORM));
  }
}

export function formatSessionTypeLabel(type: SessionType): string {
  switch (type) {
    case "sunday_service":
      return "Sunday Service";
    case "workers_meeting":
      return "Workers' Meeting";
    case "conference":
      return "Conference / Summit";
    case "general_event":
      return "General Event";
    case "custom":
      return "Custom Event";
  }
}
