export type TicketDraft = {
  summary: string;
  description: string;
  priority: string;
  issue_type: string;
  labels: string[];
  assignment_group?: string;
  assignment_reason?: string;
  category?: string;
  subcategory?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  error_condition?: string;
  error_description?: string;
  metadata?: {
    affected_system?: string;
    environment?: string;
    timestamp?: string;
    after_hours?: boolean;
  };
  screenshot_attachment?: {
    file_name?: string;
    file_type?: string;
    attached?: boolean;
  };
};

export type TicketResult = {
  attempted: boolean;
  created: boolean;
  key: string;
  url: string;
  error: string;
};