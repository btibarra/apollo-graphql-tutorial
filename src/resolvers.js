const { paginateResults } = require('./utils');

module.exports = {
  Query: {
    launches: async (_, { pageSize = 20, after }, { dataSources }) => {
      const allLaunches = await dataSources.LaunchAPI.getAllLaunches();
      allLaunches.reverse();

      const launches = paginateResults({
        after,
        pageSize,
        results: allLaunches
      });

      return {
        launches,
        cursor: launches.length ? launches[launches.length - 1].cursor : null,
        // if the cursos of the end of the paginated results is the same as the
        // last item in _all_ results, then there are no more results after this
        hasMore: launches.length
          ? launches[launches.length - 1].cursor !==
            allLaunches[allLaunches.length - 1].cursor
          : false
      };
    },
    launch: (_, { id }, { dataSources }) =>
      dataSources.LaunchAPI.getLaunchById({ launchId: id }),
    me: async (_, __, { dataSources }) => dataSources.UserAPI.findOrCreateUser()
  },
  Mission: {
    // make sure the default size is 'large' in case user doesn't specify
    missionPatch: (mission, { size } = { size: 'LARGE' }) => {
      return size === 'SMALL'
        ? mission.missionPatchSmall
        : mission.missionPatchLarge;
    }
  },
  Launch: {
    isBooked: async (launch, _, { dataSources }) =>
      dataSources.UserAPI.isBookedOnLaunch({ launchId: launch.id })
  },
  User: {
    trips: async (_, __, { dataSources }) => {
      // get ids of launches by user
      const launchIds = await dataSources.UserAPI.getLaunchIdsByUser();

      if (!launchIds.length) return [];

      // look up those launches by their ids
      return (
        dataSources.LaunchAPI.getLaunchesByIds({
          launchIds
        }) || []
      );
    }
  },
  Mutation: {
    login: async (_, { email }, { dataSources }) => {
      const user = await dataSources.UserAPI.findOrCreateUser({ email });
      if (user) return new Buffer(email).toString('base64');
    },
    bookTrips: async (_, { launchIds }, { dataSources }) => {
      const results = await dataSources.UserAPI.bookTrips({ launchIds });
      const launches = await dataSources.LaunchAPI.getLaunchesByIds({
        launchIds
      });

      return {
        success: results && results.length === launchIds.length,
        message:
          results.length === launchIds.length
            ? 'trips booked successfully'
            : `the following launches couldn't be booked: ${launchIds.filter(
                id => !results.includes(id)
              )}`,
        launches
      };
    },
    cancelTrip: async (_, { launchId }, { dataSources }) => {
      const result = dataSources.UserAPI.cancelTrip({ launchId });

      if (!result)
        return {
          sucess: false,
          message: 'failed to cancel trip'
        };

      const launch = await dataSources.LaunchAPI.getLaunchById({ launchId });
      return {
        sucess: true,
        message: 'trip cancelled',
        launches: [launch]
      };
    }
  }
};