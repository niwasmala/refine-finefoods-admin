import { CrudFilters, CrudSorting, DataProvider } from "@pankod/refine";
import { GraphQLClient } from "graphql-request";

import * as gql from "gql-query-builder";
import pluralize from "pluralize";
import camelCase from "camelcase";
import { stringify } from "query-string";

const gqlUri = `https://orderdulu-strapi-v4.herokuapp.com/graphql`;

const generateSort = (sort?: CrudSorting) => {
    if (sort && sort.length > 0) {
        const sortQuery = sort.map((i) => {
            return `${i.field}:${i.order}`;
        });

        return sortQuery.join();
    }

    return [];
};

const generateFilter = (filters?: CrudFilters) => {
    const queryFilters: { [key: string]: any } = {};

    if (filters) {
        filters.map(({ field, operator, value }) => {
            const tmp = field.split(".");
            const key = tmp[0];

            queryFilters[`${key}`] = {};

            if (tmp.length === 1) {
                queryFilters[`${key}`][`${operator}`] = value;
            } else {
                queryFilters[`${key}`] = generateFilter([{
                    field: tmp.slice(1).join('.'),
                    operator,
                    value,
                }]);
            }
        });
    }

    return queryFilters;
};

const strapiDataProvider = (client: GraphQLClient, url: string): DataProvider => {
    return {
        getList: async ({ resource, pagination, sort, filters, metaData }) => {
            const current = pagination?.current || 1;
            const pageSize = pagination?.pageSize || 10;

            const sortBy = generateSort(sort);
            const filterBy = generateFilter(filters);

            const camelResource = camelCase(resource);

            const operation = metaData?.operation ?? camelResource;
            const singularResource = pluralize.singular(resource);
            const filterInput = `${camelCase(singularResource, {pascalCase: true})}FiltersInput`;

            const { query, variables } = gql.query(
                {
                    operation,
                    variables: {
                        ...metaData?.variables,
                        sort: {
                            value: sortBy,
                            type: '[String]',
                        },
                        filters: { 
                            value: filterBy, 
                            type: filterInput,
                        },
                        pagination: {
                            value: {
                                page: current, 
                                pageSize,
                            },
                            type: "PaginationArg",
                        }
                    },
                    fields: [
                        {
                            data: [
                                'id', 
                                metaData?.fields ? `attributes { ${(metaData?.fields ?? []).join(' ')} }` : '',
                            ],
                        },
                        'meta { pagination { page pageSize pageCount total } }',
                    ],
                },
            );

            const response = await client.request(query, variables);
            const data = response[operation].data.map((item: any) => {
                return {
                    id: item.id,
                    ...item.attributes,
                };
            });

            return {
                data: data,
                total: response[operation].meta.pagination.total,
            };
        },

        // TODO
        getMany: async ({ resource, ids, metaData }) => {
            const camelResource = camelCase(resource);

            const operation = metaData?.operation ?? camelResource;

            const { query, variables } = gql.query({
                operation,
                variables: {
                    where: {
                        value: { id_in: ids },
                        type: "JSON",
                    },
                },
                fields: metaData?.fields,
            });

            const response = await client.request(query, variables);

            return {
                data: response[operation],
            };
        },

        // TODO
        create: async ({ resource, variables, metaData }) => {
            const singularResource = pluralize.singular(resource);
            const camelCreateName = camelCase(`create-${singularResource}`);

            const operation = metaData?.operation ?? camelCreateName;

            const { query, variables: gqlVariables } = gql.mutation({
                operation,
                variables: {
                    input: {
                        value: { data: variables },
                        type: `${camelCreateName}Input`,
                    },
                },
                fields: metaData?.fields ?? [
                    {
                        operation: singularResource,
                        fields: ["id"],
                        variables: {},
                    },
                ],
            });
            const response = await client.request(query, gqlVariables);

            return {
                data: response[operation][singularResource],
            };
        },

        // TODO
        createMany: async ({ resource, variables, metaData }) => {
            const singularResource = pluralize.singular(resource);
            const camelCreateName = camelCase(`create-${singularResource}`);

            const operation = metaData?.operation ?? camelCreateName;

            const response = await Promise.all(
                variables.map(async (param) => {
                    const { query, variables: gqlVariables } = gql.mutation({
                        operation,
                        variables: {
                            input: {
                                value: { data: param },
                                type: `${camelCreateName}Input`,
                            },
                        },
                        fields: metaData?.fields ?? [
                            {
                                operation: singularResource,
                                fields: ["id"],
                                variables: {},
                            },
                        ],
                    });
                    const result = await client.request(query, gqlVariables);

                    return result[operation][singularResource];
                }),
            );
            return {
                data: response,
            };
        },

        update: async ({ resource, id, variables, metaData }) => {
            const singularResource = pluralize.singular(resource);
            const camelUpdateName = camelCase(`update-${singularResource}`);

            const operation = metaData?.operation ?? camelUpdateName;

            const { query, variables: gqlVariables } = gql.mutation({
                operation,
                variables: {
                    id: {
                        value: id,
                        type: 'ID!',
                    },
                    data: {
                        value: variables,
                        type: camelCase(`${singularResource}Input!`, {pascalCase: true}),
                    },
                },
                fields: [
                    {
                        operation: 'data',
                        fields: [
                            'id', 
                            metaData?.fields ? `attributes { ${(metaData?.fields ?? []).join(' ')} }` : '',
                        ],
                        variables: {},
                    },
                ],
            });
            const response = await client.request(query, gqlVariables);

            return {
                data: response[operation][singularResource],
            };
        },

        // TODO
        updateMany: async ({ resource, ids, variables, metaData }) => {
            const singularResource = pluralize.singular(resource);
            const camelUpdateName = camelCase(`update-${singularResource}`);

            const operation = metaData?.operation ?? camelUpdateName;

            const response = await Promise.all(
                ids.map(async (id) => {
                    const { query, variables: gqlVariables } = gql.mutation({
                        operation,
                        variables: {
                            input: {
                                value: { where: { id }, data: variables },
                                type: `${camelUpdateName}Input`,
                            },
                        },
                        fields: metaData?.fields ?? [
                            {
                                operation: singularResource,
                                fields: ["id"],
                                variables: {},
                            },
                        ],
                    });
                    const result = await client.request(query, gqlVariables);

                    return result[operation][singularResource];
                }),
            );
            return {
                data: response,
            };
        },

        
        getOne: async ({ resource, id, metaData }) => {
            console.log('getOne', resource, id, metaData);
            const singularResource = pluralize.singular(resource);
            const camelResource = camelCase(singularResource);

            const operation = metaData?.operation ?? camelResource;

            const { query, variables } = gql.query({
                operation,
                variables: {
                    id: { value: id, type: "ID", required: true },
                },
                fields: [
                    {
                        data: [
                            'id', 
                            metaData?.fields ? `attributes { ${(metaData?.fields ?? []).join(' ')} }` : '',
                        ],
                    },
                ],
            });

            const response = await client.request(query, variables);
            const data = {
                id: response[operation].id,
                ...response[operation].attributes,
            };

            return {
                data: data,
            };
        },

        // TODO
        deleteOne: async ({ resource, id, metaData }) => {
            const singularResource = pluralize.singular(resource);
            const camelDeleteName = camelCase(`delete-${singularResource}`);

            const operation = metaData?.operation ?? camelDeleteName;

            const { query, variables } = gql.mutation({
                operation,
                variables: {
                    input: {
                        value: { where: { id } },
                        type: `${camelDeleteName}Input`,
                    },
                },
                fields: metaData?.fields ?? [
                    {
                        operation: singularResource,
                        fields: ["id"],
                        variables: {},
                    },
                ],
            });

            const response = await client.request(query, variables);

            return {
                data: response[operation][singularResource],
            };
        },

        // TODO
        deleteMany: async ({ resource, ids, metaData }) => {
            const singularResource = pluralize.singular(resource);
            const camelDeleteName = camelCase(`delete-${singularResource}`);

            const operation = metaData?.operation ?? camelDeleteName;

            const response = await Promise.all(
                ids.map(async (id) => {
                    const { query, variables: gqlVariables } = gql.mutation({
                        operation,
                        variables: {
                            input: {
                                value: { where: { id } },
                                type: `${camelDeleteName}Input`,
                            },
                        },
                        fields: metaData?.fields ?? [
                            {
                                operation: singularResource,
                                fields: ["id"],
                                variables: {},
                            },
                        ],
                    });
                    const result = await client.request(query, gqlVariables);

                    return result[operation][singularResource];
                }),
            );
            return {
                data: response,
            };
        },

        getApiUrl: () => {
            return url;
        },

        // TODO
        custom: async ({ url, method, headers, metaData }) => {
            let gqlClient = client;

            if (url) {
                gqlClient = new GraphQLClient(url, { headers });
            }

            if (metaData) {
                if (metaData.operation) {
                    if (method === "get") {
                        const { query, variables } = gql.query({
                            operation: metaData.operation,
                            fields: metaData.fields,
                            variables: metaData.variables,
                        });

                        const response = await gqlClient.request(
                            query,
                            variables,
                        );

                        return {
                            data: response[metaData.operation],
                        };
                    } else {
                        const { query, variables } = gql.mutation({
                            operation: metaData.operation,
                            fields: metaData.fields,
                            variables: metaData.variables,
                        });

                        const response = await gqlClient.request(
                            query,
                            variables,
                        );

                        return {
                            data: response[metaData.operation],
                        };
                    }
                } else {
                    throw Error("GraphQL operation name required.");
                }
            } else {
                throw Error(
                    "GraphQL need to operation, fields and variables values in metaData object.",
                );
            }
        },
    };
};

export const client = new GraphQLClient(gqlUri)
export const dataProvider = strapiDataProvider(client, gqlUri);