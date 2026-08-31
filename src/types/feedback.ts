export interface PostFeedback {
  id: string;
  post_id: string;
  author_role: 'gestor' | 'cliente';
  author_name: string;
  message: string;
  created_at: string;
  type: 'message' | 'log';
  version_name?: string | null;
}

// --- Tags ---

export interface Tag {
  name: string;
  color: string;
}

// --- Feedback Cards (Trello-like) ---

export type FeedbackCardPriority = 'normal' | 'urgente';
export type FeedbackCardStatus = string;

export interface FeedbackCard {
  id: string;
  post_id: string | null;
  title: string;
  description: string;
  deadline: string;
  priority: FeedbackCardPriority;
  status: FeedbackCardStatus;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  requested_at?: string | null;
  version_name?: string | null;
  tags?: Tag[];
  user_id?: string | null;
}

export interface FeedbackCardAttachment {
  id: string;
  card_id: string;
  type: 'image' | 'link';
  url: string;
  name: string | null;
  created_at: string;
}

export interface FeedbackCardChecklistItem {
  id: string;
  card_id: string;
  text: string;
  checked: boolean;
  created_at: string;
}

export interface FeedbackCardComment {
  id: string;
  card_id: string;
  author_role: string;
  author_name: string;
  message: string;
  created_at: string;
}

export interface FeedbackCardFull extends FeedbackCard {
  attachments: FeedbackCardAttachment[];
  checklist: FeedbackCardChecklistItem[];
  comments: FeedbackCardComment[];
}
