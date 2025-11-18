/**
 *
 * This component is the skeleton around the actual pages, and should only
 * contain code that should be seen on all pages. (e.g. navigation bar)
 *
 */

import { AnErrorOccurred } from "@strapi/helper-plugin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Route, Switch } from "react-router-dom";
import "../../global.css";
import pluginId from "../../pluginId";
import { ExporterPage } from "../Exporter";
import { ImporterPage } from "../Importer";

const App = () => {
  const [queryClient, _] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <Switch>
          <Route path={`/plugins/${pluginId}`} exact>
            <ImporterPage />
          </Route>
          <Route path={`/plugins/${pluginId}/exporter`}>
            <ExporterPage />
          </Route>
          <Route component={AnErrorOccurred} />
        </Switch>
      </div>
    </QueryClientProvider>
  );
};

export default App;
