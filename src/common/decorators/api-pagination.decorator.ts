import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, getSchemaPath } from '@nestjs/swagger';

export const ApiPaginatedResponse = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                properties: {
                  totalItems: {
                    type: 'number',
                  },
                  itemCount: {
                    type: 'number',
                  },
                  itemsPerPage: {
                    type: 'number',
                  },
                  totalPages: {
                    type: 'number',
                  },
                  currentPage: {
                    type: 'number',
                  },
                },
              },
            },
          },
        ],
      },
    }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiQuery({ name: 'sort', required: false, type: String }),
  );
};