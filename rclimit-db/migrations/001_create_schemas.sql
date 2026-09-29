-- Migration 001: Create extensions and schemas
-- RCLimit Database Schema Setup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS system;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS accounting;
-- public schema already exists by default
