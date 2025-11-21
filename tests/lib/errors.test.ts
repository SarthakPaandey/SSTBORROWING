import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  isOperationalError,
  handleApiError,
} from '@/lib/errors';
import { NextResponse } from 'next/server';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default status code', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Test error', 400);
      expect(error.statusCode).toBe(400);
    });

    it('should maintain instanceof relationship', () => {
      const error = new AppError('Test error');
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should have status code 400', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should have status code 401', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AuthorizationError', () => {
    it('should have status code 403', () => {
      const error = new AuthorizationError();
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should have status code 404', () => {
      const error = new NotFoundError('Resource');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Resource');
    });
  });

  describe('ConflictError', () => {
    it('should have status code 409', () => {
      const error = new ConflictError('Conflict occurred');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('DatabaseError', () => {
    it('should have status code 500 and be non-operational', () => {
      const error = new DatabaseError('DB error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ExternalServiceError', () => {
    it('should have status code 502 and be non-operational', () => {
      const error = new ExternalServiceError('Email service');
      expect(error.statusCode).toBe(502);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      const error = new ValidationError('Test');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      const error = new DatabaseError('Test');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for standard Error', () => {
      const error = new Error('Test');
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('handleApiError', () => {
    it('should handle AppError correctly', () => {
      const error = new ValidationError('Invalid input');
      const response = handleApiError(error);
      
      expect(response).toBeInstanceOf(NextResponse);
      // Note: We can't easily test the JSON body without more setup
    });

    it('should handle standard Error', () => {
      const error = new Error('Standard error');
      const response = handleApiError(error);
      
      expect(response).toBeInstanceOf(NextResponse);
    });

    it('should handle unknown error types', () => {
      const response = handleApiError('string error');
      expect(response).toBeInstanceOf(NextResponse);
    });
  });
});

