/**
 * UI Types — Modèles du Design System & Composants UI WhatsApp
 */

import { CommandContext } from '../../core/plugin-system/types.js';

export type ButtonType = 'quick_reply' | 'cta_url' | 'cta_copy' | 'cta_call';

export interface UIButton {
  type: ButtonType;
  displayText: string;
  id?: string;          // For quick_reply (payload or command trigger, e.g. ".menu ai")
  url?: string;         // For cta_url
  copyCode?: string;    // For cta_copy (text copied to clipboard)
  phoneNumber?: string; // For cta_call
}

export interface UIHeader {
  title?: string;
  subtitle?: string;
  hasMediaAttachment?: boolean;
  imageBuffer?: Buffer;
  imageUrl?: string;
}

export interface UICard {
  header?: UIHeader;
  title: string;
  subtitle?: string;
  body: string;
  footer?: string;
  buttons?: UIButton[];
  metadata?: Record<string, any>;
}

export interface UICarousel {
  title?: string;
  cards: UICard[];
  footer?: string;
}

export interface UIListItem {
  id: string;
  title: string;
  description?: string;
  highlightText?: string;
}

export interface UIListSection {
  title: string;
  rows: UIListItem[];
}

export interface UIList {
  title: string;
  description: string;
  buttonText: string;
  footer?: string;
  sections: UIListSection[];
}

export interface RenderOptions {
  forceText?: boolean;
  mentions?: string[];
}

export interface ThemeConfig {
  name: string;
  prefix: string;
  icons: {
    primary: string;
    category: string;
    command: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    locked: string;
    public: string;
    arrowLeft: string;
    arrowRight: string;
    bullet: string;
    sparkles: string;
  };
  categories: Record<string, {
    icon: string;
    title: string;
    description: string;
    badge: string;
    imageUrl?: string;
  }>;
  borders: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
    leftT: string;
    rightT: string;
  };
}
