import { useState, useEffect } from 'react';
import checkSession, { getUser } from './user.ts';

function Dashboard({ user } : { user: string }) {  
  return (
    <h1>Welcome {user}!</h1>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [button, setButton] = useState(false);
  const [user, setUser] = useState("user");

  useEffect(() => {
    async function setSessionParams() {
      const isValid = await checkSession();
      setLoading(false);
      setButton(!isValid);

      if (isValid) {
        setUser(await getUser());
      }
    }

    setSessionParams();
  }, []);


  if (loading) {
    return <div className="centered-elem"><h1>Loading....</h1></div>;
  }

  if (button) {
    return (
      <div className="centered-elem">
        <button onClick={() => window.location.href="/api/login"}>
          Login with github
        </button>
      </div>
    );
  }
  else {
    return (
      <Dashboard user={user}></Dashboard>
    );
  }
}

export default App;
