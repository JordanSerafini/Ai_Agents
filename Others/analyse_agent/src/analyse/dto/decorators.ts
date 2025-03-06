import {
  IsString,
  IsArray,
  IsObject,
  IsDate,
  IsNumber,
  ValidationOptions,
  ValidateNested as ClassValidatorNested
} from 'class-validator';
import { Type } from 'class-transformer';

// @ts-nocheck

export function ValidateString(validationOptions?: ValidationOptions) {
  return IsString({ ...validationOptions });
}

export function ValidateArray(validationOptions?: ValidationOptions) {
  return IsArray({ ...validationOptions });
}

export function ValidateObject(validationOptions?: ValidationOptions) {
  return IsObject({ ...validationOptions });
}

export function ValidateDate(validationOptions?: ValidationOptions) {
  return IsDate({ ...validationOptions });
}

export function ValidateNumber(validationOptions?: ValidationOptions) {
  return IsNumber({}, { ...validationOptions });
}

export function ValidateNested(validationOptions?: ValidationOptions) {
  return ClassValidatorNested({ ...validationOptions });
}

export const ValidateNestedObject = ClassValidatorNested;
export const ValidateNestedArray = ((options?: ValidationOptions) =>
  ValidateNested({ ...options, each: true })) as unknown as (
  options?: ValidationOptions,
) => PropertyDecorator;
export const TransformType = Type as unknown as (
  type: () => any,
) => PropertyDecorator;
