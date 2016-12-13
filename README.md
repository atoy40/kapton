# Kapton

A way of using GraphQL (through Apollo Client) in your Polymer elements.

Kapton is also the name of a polymer used on the Apollo Lunar Module.

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
import Kapton from 'kapton';
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

// get a behavior "factory"
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

export { graphql, USERS_LIST, ADD_USER };
```

In this example Webpack configuration will use a library "var" output with the
library set to "Apollo", so the graphql exported variable will be accessible
through "Apollo.graphql".

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
  Polymer({
      is:"my-graphql",

      behaviors:[
        Apollo.graphql(Apollo.USERS_LIST, 'myQueryOpts'),
        Apollo.graphql(Apollo.ADD_USER, { name: "addUser" }),
      ],

      properties: {

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
      },

      _computeMyQueryOptions: function(limit, authenticated) {
        return {
          variables: {
            limit: limit,
          },
          forceFetch: true,
          skip: !authenticated,
        };
      },

      _createUser: function() {
        // mutate is the default name of the mutation function added to the
        // element
        this.addUser({
          variables: {
            uid: this.$.uidInput.value,
            lastname: this.$.lastnameInput.value,
          },
          // generate a fake result to speed-up UI. To incorporate it to the
          // query above, you'll have to use updateQueries or resultBehaviors.
          // This is optional.
          optimisticResponse: {
            addUser: {
              __typename: 'User',
              uid: this.$.uidInput.value,
              lastname: this.$.lastnameInput.value,
            }
          },
          // this resultBehavior will add the mutation result (the real one as
          // well as the optimistic one) to the "users" list in the store. It
          // means dependings queries will be updated.
          // This is optional.
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: ['addUser'],
              storePath: ['ROOT_QUERY', 'users'],
              where: 'APPEND',
            }
          ]
        }).then(function(result) {
          this._resetForm();
        }.bind(this));
      }
  });
</script>
```

## Details

In all examples, we'll assume the behavior factory is Apollo.graphql() (see
usage example above).

### Query or subscription behavior

Behavior factory can be used this ways :

```js
// using reactive options
Apollo.graphql(queryOrSubscriptionDocument, "options_property_name");
// using static options
Apollo.graphql(queryOrSubscriptionDocument, { name: "myData", variables: { foo: "bar " } });
// using default options
Apollo.graphql(queryOrSubscriptionDocument);
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

### Mutation behavior

```js
// without options
Apollo.graphql(mutationDocument);
// using static options
Apollo.graphql(mutationDocument, { name: "createFoo" });
```

### Mutation options

The option object can contains the following keys:

* name : the name of the function added to the element to call this mutation.
Default is "mutate".

The mutation function (aka "mutate") can also contains options (variables,
optimisticResponse, updateQueries, ...). See apollo-client documentation.
