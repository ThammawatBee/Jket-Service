import { BadRequestException, ValidationError } from '@nestjs/common';

export class ValidationException extends BadRequestException {
  constructor(public validationErrors: ValidationError[]) {
    super(
      validationErrors.map(
        (error) =>
          `Validate ${error.property} has wrong value ${JSON.stringify(
            error.value,
          )}`,
      ),
    );
  }
}
