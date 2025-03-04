import {
  IsString,
  IsArray,
  IsObject,
  IsDate,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

// @ts-nocheck

export const ValidateString = IsString as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const ValidateArray = IsArray as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const ValidateObject = IsObject as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const ValidateDate = IsDate as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const ValidateNestedObject = ValidateNested as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const ValidateNestedArray = ((options?: ValidationOptions) =>
  ValidateNested({ ...options, each: true })) as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const TransformType = Type as unknown as (
  type: () => any,
) => PropertyDecorator;
