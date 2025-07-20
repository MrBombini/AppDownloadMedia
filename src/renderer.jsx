import './index.css';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom'; // <-- aquí

import MainMenu from './components/mainmenu';
import NotificationContainer from './components/notification';

const App = () => {
    return (
        <>
            <NotificationContainer />
            <Router>
                <Routes>
                    <Route path="/" element={<MainMenu />} />
                    {/* Puedes agregar más rutas aquí */}
                </Routes>
            </Router>
        </>
    )
};

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
