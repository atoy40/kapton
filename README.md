# Kapton

A way of using GraphQL (through Apollo Client) in your Polymer 2.0 elements
through class mixins.

Kapton is also the name of a polymer used on the Apollo Lunar Module.

A sample application is available at https://github.com/atoy40/kapton-sample

## Usage

### A schema

This is the GraphQL schema used in the examples below in GraphQL schema
language.

```graphql
type User {
  uid: String!
  lastname: String!
}

type RootQuery {
  users(limit: Int): [User!]
}

type RootMutation {
  addUser(uid: String!, lastname: String!) : User
}

schema {
  query: RootQuery
  mutation: RootMutation
}
```

### Configuration

You'll probably use a javascript entry point "packaged" using a tool like
webpack or browserify. The following example use webpack

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import Kapton, { createKaptonMixin } from 'kapton';
import gql from 'graphql-tag';

// Create the apollo client
const apolloClient = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: 'http://localhost:8080/graphql',
  }),
  // define unique id of User's
  dataIdFromObject: (result) => {
    return result.__typename+'_'+result.uid;
  }
});

// get a mixin "factory"
const graphql = Kapton({apolloClient});

// get a query document
const USERS_LIST = gql`
  query myQuery($limit: Int!) {
    users(limit: $limit) {
      uid
      lastname
    }
  }
`;

// get a mutation document
const ADD_USER = gql`
  mutation myMutation($uid: String, $lastname: String) {
    addUser(uid: $uid, lastname: $lastname) {
      uid
      lastname
    }
  }
`;

export { graphql, createKaptonMixin, USERS_LIST, ADD_USER };
```

In this example Webpack configuration will use a library "var" output with the
library set to "App", so exported variables will be accessible through the
global "App" object (for example App.graphql or App['graphql']).

### Usage in components

This small example contains a query and a mutation.

```html
<link rel="import" href="a-piece-of-html-loading-webpacked-js.html">

<dom-module id="my-graphql">
  <template>
    <style>
      :host {
        display: block;
        padding: 10px;
      }
    </style>

    <ul>
      <template is="dom-repeat" items="{{data.users}}">
        <li>{{item.uid}} : {{item.lastname}}</li>
      </template>
    </ul>

    <div>
      <input id="uidInput" type="text">
      <input id="lastnameInput" type="text">
      <button on-tap="_createUser">Create</button>
    </div>

  </template>

<script>
  const UserListMixin = App.createKaptonMixin(App.graphql, App.USERS_LIST, 'myQueryOpts');
  const AddUserMixin = App.createKaptonMixin(App.graphql, App.ADD_USER, { name: "addUser" });

  class MyGraphql extends UserListMixin(AddUserMixin(Polymer.Element)) {

    static get is() { return 'my-graphql'; }

    static get properties() {
      return {

        authenticated: Boolean,

        limit: Number,

        // each time limit or authenticated properties will change, your query
        // will be updated and sent to server if needed.
        myQueryOpts: {
          type: Object,
          computed: '_computeMyQueryOptions(limit, authenticated)',
        },

        // the default variable receiving query result
        data: Object,
      };
    }

    _computeMyQueryOptions(limit, authenticated) {
      return {
        variables: {
          limit: limit,
        },
        forceFetch: true,
        skip: !authenticated,
      };
    }

    _createUser() {
      // mutate is the default name of the mutation function added to the
      // element
      this.addUser({
        variables: {
          uid: this.$.uidInput.value,
          lastname: this.$.lastnameInput.value,
        }
      }).then(function(result) {
        this._resetForm();
      }.bind(this));
    }
  }
  customElements.define(MyGraphql.is, MyGraphql);
</script>
```

## Details

In all examples, we'll assume the mixin factory is App.graphql (seeusage example
above).

If your element have more than one Kapton mixin, it can be useful to use the
helper function createKaptonMixin :

`mixin = createKaptonMixin(factory, document, options)`

### Query or subscription Mixin

Mixin factory can be used this ways :

```js
// using reactive options
App.graphql(queryOrSubscriptionDocument, "options_property_name", superClass);
// using static options
App.graphql(queryOrSubscriptionDocument, { name: "myData", variables: { foo: "bar " } }, superClass);
// using default options
App.graphql(queryOrSubscriptionDocument, null, superClass);
```

Subscriptions will require more configuration and set-up you've seen in the
example above. Check Apollo graphql-subscriptions and subscriptions-transport-ws
project on github. It implements GraphQL subscriptions using websocket.

### Query options

The option object can contains the following keys:

* skip : a boolean to subscribe/unsubscribe the apollo observable ("freeze" the
query or subscription). Typical usage is to wait a user to be authenticated to
fire queries or stop receiving subscription results.
* name : the name of the element property that will get query or subscription
result. Default is "data".
* All options availables in the apollo watchQuery() or subscribe() function.

### Query result object (default to "data")

The result contains all the keys you'd have found in the data key of the graphql
result. It also contains the following keys allowing advanced usages :

* refetch()
* fetchMore()
* updateQuery()
* startPolling()
* stopPolling()
* subscribeToMore()
* variables : an object containing variables used to get this result.
* loading : boolean, useful if you set notifyOnNetworkStatusChange to true in
query options.
* networkStatus : the status of the request, useful if you set
notifyOnNetworkStatusChange to true in query options

### Subscription result object (default to "data")

The result only contains the key(s) you'd have found in the data key of the
graphql result.

### Mutation Mixin

```js
// without options
App.graphql(mutationDocument, null, superClass);
// using static options
App.graphql(mutationDocument, { name: "createFoo" }, superClass);
```

### Mutation options

The option object can contains the following keys:

* name : the name of the function added to the element to call this mutation.
Default is "mutate".

The mutation function (aka "mutate") can also contains options (variables,
optimisticResponse, updateQueries, ...). See apollo-client documentation.

### More complexe examples

the addUser mutation can use more advanced features of Apollo client, for
example optimisticResponse and updateQueries. Check Apollo documentation for
more informations. In the first example, the addUser result will not be added to
the user list. The following code fix this problem :

```js
_createUser() {
  // mutate is the default name of the mutation function added to the
  // element
  this.addUser({
    variables: {
      uid: this.$.uidInput.value,
      lastname: this.$.lastnameInput.value,
    },
    // generate a fake result to speed-up UI. To incorporate it to the
    // query above, you'll have to use updateQueries.
    // This is optional.
    optimisticResponse: {
      addUser: {
        __typename: 'User',
        uid: this.$.uidInput.value,
        lastname: this.$.lastnameInput.value,
      }
    },
    // this updateQueries will add the mutation result (the real one as
    // well as the optimistic one) to the "users" list in the store. It
    // means dependings queries will be updated.
    // This is optional.
    updateQueries: {
      myQuery: (prev, { mutationResult }) => {
        return Object.assign({}, prev, { users: [ ...prev.users, mutationResult.data.addUser ] });
      }
    }
  }).then(function(result) {
    this._resetForm();
  }.bind(this));
}
```
