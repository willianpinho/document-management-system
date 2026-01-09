import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiPaginatedResponse = <TModel extends Type<unknown>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                properties: {
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'number', example: 1 },
                      limit: { type: 'number', example: 20 },
                      total: { type: 'number', example: 100 },
                      totalPages: { type: 'number', example: 5 },
                      hasNext: { type: 'boolean', example: true },
                      hasPrevious: { type: 'boolean', example: false },
                    },
                  },
                },
              },
              timestamp: {
                type: 'string',
                example: '2026-01-08T12:00:00.000Z',
              },
            },
          },
        ],
      },
    }),
  );
};
