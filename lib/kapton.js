import omit from 'lodash.omit';
import parser from './parser';

export const createKaptonMixin = (kapton, document, options) => {
  return (superClass) => {
    return kapton(document, options, superClass);
  };
};

export default ({ apolloClient }) => {

  function observableQueryFields(observable) {

    const fields = {};

    ['variables', 'refetch', 'fetchMore', 'updateQuery', 'startPolling', 'stopPolling', 'subscribeToMore'].forEach((key) => {
      if (typeof observable[key] === 'function') {
        fields[key] = observable[key].bind(observable);
      } else if (observable[key] !== undefined) {
        fields[key] = observable[key];
      }
    });

    return fields;
  }

  return (document, options, superClass) => {

    const rid = Math.floor(1000000000 + (Math.random() * 9000000000));
    const operation = parser(document);

    class GraphQL {

      constructor({ options = {} }) {
        this.queryObservable = null;
        this.querySubscription = null;
        this.initialOptions = options;
        this.computedOptions = typeof options === "string";
      }

      optionsChanged(el, change) {
        if (change.path === this.initialOptions) {
          //console.log("full change");
        }

        if (change.base.skip) {
          if (this.currentOptions && !this.currentOptions.skip) {
            return this.unsubscribeFromQuery();
          }
          return; // skip an already skipped
        }

        this.currentOptions = Object.assign({}, change.base);
        this.subscribeToQuery(el);
      }

      ready(el) {
        if (operation.type === "Mutation") {
          this.currentOptions = this.initialOptions;
          this.setDataToProp(el);
        }

        if (!this.computedOptions) {
          this.currentOptions = this.initialOptions;
          this.subscribeToQuery(el);
        }
      }

      generateQueryOptions() {
        return omit(this.currentOptions, ['skip', 'name']);
      }

      createQuery() {
        if (operation.type === "Query") {
          this.queryObservable = apolloClient.watchQuery(Object.assign({
            query: document
          }, this.generateQueryOptions()));
        } else if (operation.type === "Subscription") {
          this.queryObservable = apolloClient.subscribe(Object.assign({
            query: document
          }, this.generateQueryOptions()));
        }
      }

      subscribeToQuery(el) {
        if (operation.type === "Mutation") {
          return;
        }

        if (this.querySubscription) {
          if (typeof this.queryObservable.setOptions === "function") {
            this.queryObservable.setOptions(this.generateQueryOptions());
            return;
          }
          this.unsubscribeFromQuery();
        }

        if (!this.queryObservable) {
          this.createQuery();
        } else {
          // unskipped query, update options before re-subscribing
          this.queryObservable.setOptions(this.generateQueryOptions());
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

        const elmData = {};

        if (operation.type === "Subscription") {
          Object.assign(elmData, result, {
            loading: true,
            variables: this.currentOptions.variables
          }, observableQueryFields(this.queryObservable));

        } else {
          const { data, loading, networkStatus } = result;
          Object.assign(elmData, data, {
            loading,
            networkStatus
          }, observableQueryFields(this.queryObservable));
        }

        el.set(name, elmData);
      }

      unsubscribeFromQuery() {
        if (this.querySubscription) {
          this.querySubscription.unsubscribe();
          delete this.querySubscription;

          // subscription doesn't support setOptions, need to recreate observable
          if (operation.type === "Subscription") {
            delete this.queryObservable;
          }
        }
      }
    }

    return class extends superClass {

      constructor() {
        super();

        this[`__kapton_instance_${rid}`] = new GraphQL({ options });

        if (typeof options === "string") {
          this[`__kapton_observer_${rid}`] = (change) => {
            this[`__kapton_instance_${rid}`].optionsChanged(this, change);
          }
        }
      }

      ready() {
        super.ready();
        this[`__kapton_instance_${rid}`].ready(this);
      }

      static get observers() {
        if (typeof options === "string") {
          return [ `__kapton_observer_${rid}(${options}.*)` ];
        }
      }
    }

  }

};
