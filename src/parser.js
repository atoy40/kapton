export default function parser(document) {
  // variables
  let fragments, queries, mutations, subscriptions, variables, definitions, type, name;

  if(!document && !document.kind) {
    // tslint:disable-line
    throw new Error(`Argument of ${document} passed to parser was not a valid GraphQL Document. You may need to use 'graphql-tag' or another method to convert your operation into a document`);
  }

  fragments = document.definitions.filter(
    (x) => x.kind === 'FragmentDefinition'
  );

  /*fragments = createFragment({
    kind: 'Document',
    definitions: [...fragments],
  });*/

  queries = document.definitions.filter(
    (x) => x.kind === 'OperationDefinition' && x.operation === 'query'
  );

  mutations = document.definitions.filter(
    (x) => x.kind === 'OperationDefinition' && x.operation === 'mutation'
  );

  subscriptions = document.definitions.filter(
    (x) => x.kind === 'OperationDefinition' && x.operation === 'subscription'
  );

  if (fragments.length && (!queries.length || !mutations.length || !subscriptions.length)) {
    throw new Error(`Passing only a fragment to 'graphql' is not yet supported. You must include a query, subscription or mutation as well`);
  }

  if (queries.length && mutations.length && mutations.length) {
    if ((queries.length + mutations.length + mutations.length) > 1) {
      throw new Error(`poly-apollo only supports a query, subscription, or a mutation per Behavior. ${document} had ${queries.length} queries, ${subscriptions.length} subscriptions and ${mutations.length} muations. You can use 'compose' to join multiple operation types to a component`);
    }
  }

  type = queries.length ? "Query" : "Mutation";
  if (!queries.length && !mutations.length) type = "Subscription";

  definitions = queries.length ? queries : mutations;
  if (!queries.length && !mutations.length) definitions = subscriptions;

  if (definitions.length !== 1) {
    throw new Error(`poly-apollo only supports one defintion per HOC. ${document} had ${definitions.length} definitions. You can use 'compose' to join multiple operation types to a component`);
  }

  variables = definitions[0].variableDefinitions || [];
  let hasName = definitions[0].name && definitions[0].name.kind === 'Name';
  name = hasName ? definitions[0].name.value : 'data'; // fallback to using data if no name
  fragments = fragments.length ? fragments : [];

  return { name, type, variables, fragments };
}
