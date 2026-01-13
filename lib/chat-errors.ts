/**
 * Error handling utilities for Chatbot feature
 */

import type { ChatError } from "@/types/chat";

/**
 * Creates a standardized error response
 */
export function createChatError(
  code: string,
  message: string,
  details?: unknown
): ChatError {
  return {
    code,
    message,
    details,
  };
}

/**
 * Masks sensitive information (like API keys) from error messages
 */
export function maskSensitiveInfo(message: string): string {
  // Mask API keys (common patterns)
  return message
    .replace(/sk-[a-zA-Z0-9]{32,}/g, "sk-***")
    .replace(/[a-zA-Z0-9]{32,}/g, (match) => {
      // Mask long strings that might be API keys
      if (match.length > 32) {
        return match.substring(0, 8) + "***";
      }
      return match;
    });
}

/**
 * Formats error for API response
 */
export function formatErrorResponse(
  error: unknown,
  includeDetails = false
): ChatError {
  if (error instanceof Error) {
    const message = maskSensitiveInfo(error.message);
    return createChatError(
      "CHAT_ERROR",
      message,
      includeDetails ? error.stack : undefined
    );
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    return error as ChatError;
  }

  return createChatError(
    "UNKNOWN_ERROR",
    "An unexpected error occurred",
    includeDetails ? String(error) : undefined
  );
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  CONFIG_MISSING: "CONFIG_MISSING",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_REQUEST: "INVALID_REQUEST",
  LLM_ERROR: "LLM_ERROR",
  TIMEOUT: "TIMEOUT",
  RATE_LIMIT: "RATE_LIMIT",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

