import { Switch, Route, Router as WouterRouter } from "wouter";
import Game from "@/pages/Game";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Game} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
