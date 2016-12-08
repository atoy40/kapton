function parser(document) {
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

export default function({ apolloClient }) {

  function observableQueryFields(observable) {

    const fields = {};

    ['variables', 'refetch', 'fetchMore', 'updateQuery', 'startPolling', 'stopPolling', 'subscribeToMore'].forEach((key) => {
      if (typeof observable[key] === 'function') {
        fields[key] = observable[key].bind(observable);
      } else {
        fields[key] = observable[key];
      }
    });

    return fields;
  }

  return function(document, options) {

    const operation = parser(document);
    console.log(operation);

    class GraphQL {

      constructor({ options = {} }) {
        this.queryObservable = null;
        this.querySubscription = null;
        this.initialOptions = options;
        this.computedOptions = typeof options === "string";
        this.initialLoadingDone = false;
        this.rid = Math.floor(1000000000 + (Math.random() * 9000000000));
      }

      init(el) {
        if (this.computedOptions) {
          const self = this;
          el[`__apollo_${this.rid}`] = function(change) {
            self.optionsChanged(this, change);
          };
          el._addComplexObserverEffect(`__apollo_${this.rid}(${this.initialOptions}.*)`);
        } else {
          // static options
          this.currentOptions = this.initialOptions;
        }

        if (operation.type === "Mutation") {
          this.setDataToProp(el);
          return;
        }
      }

      optionsChanged(el, change) {
        if (change.path === this.initialOptions) {
          //console.log("full change");
        }

        if (change.base.skip) {
          if (this.currentOptions && !this.currentOptions.skip) {
            return this.unsubscribeFromQuery()
          }
          return; // skip an already skipped
        }

        let unskipped = !change.base.skip && this.currentOptions && this.currentOptions.skip;
        console.log(unskipped);
        this.currentOptions = change.base;
        this.subscribeToQuery(el, unskipped);
      }

      ready(el) {
        if (operation.type === "Mutation" || this.querySubscription) {
          return;
        }

        if (!this.computedOptions) {
          this.subscribeToQuery(el);
        }
      }

      generateQueryOptions() {
        return this.currentOptions;
      }

      createQuery() {
        if (operation.type === "Query") {
          this.queryObservable = apolloClient.watchQuery(Object.assign({
            query: document
          }, this.generateQueryOptions()));
        }
      }

      subscribeToQuery(el, forceSetVars = false) {
        if (operation.type === "Mutation") {
          return;
        }

        if (this.querySubscription || forceSetVars) {
          this.queryObservable.setOptions(this.generateQueryOptions());
          return;
        }

        if (!this.queryObservable) {
          this.createQuery();
        }

        const next = (result) => {
          this.setDataToProp(el, result);
        };

        const handleError = (error) => {
          console.log(error);
          //if (error instanceof ApolloError) return next({ error });
          //throw error;
        };

        this.querySubscription = this.queryObservable.subscribe({
          next,
          error: handleError
        });
      }

      setDataToProp(el, result) {
        let name = operation.type === "Mutation" ? "mutate" : "data";
        if (this.currentOptions && this.currentOptions.name) {
          name = this.currentOptions.name;
        }

        if (operation.type === "Mutation") {
          return el.set(name, (opts) => {
            opts.mutation = document;
            return apolloClient.mutate(opts);
          });
        }

        const { data, loading, networkStatus } = result;

        const elmData = Object.assign({}, data, {
          loading,
          networkStatus
        }, observableQueryFields(this.queryObservable));

        el.set(name, elmData);
      }

      unsubscribeFromQuery() {
        if (this.querySubscription) {
          console.log("unsub");
          this.querySubscription.unsubscribe();
          delete this.querySubscription;
        }
      }
    }

    const graphql = new GraphQL({ options });

    return {

      beforeRegister() {
        console.log("beforeRegister");
        graphql.init(this);
      },

      registered: function() {
        console.log("registered");
      },

      ready() {
        console.log("ready");
        graphql.ready(this);
      },

      attached() {
        console.log("attached");
      },

      detached() {
        console.log("detached");
        //graphql.detached(this);
      }
    };
  }
};
