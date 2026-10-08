import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useMidtermMode } from './contexts/MidtermModeContext';
import { MidtermModeProvider } from './contexts/MidtermModeProvider';

import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import CreateAccount from './pages/CreateAccount';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import BidCommitteeDashboard from './pages/BidCommitteeDashboard';
import RusheeZoom from './pages/RusheeZoom';
import RusheePage from './pages/RusheePage';
import Pis from './pages/Pis';

import MyError from './components/Error';
import Admin from './pages/Admin';
import Attendance from './pages/Attendance';
import AddTimeslotPage from './pages/AddTimeslotPage';
import AddPis from './pages/AddPis';
import MyPisPage from './pages/MyPisPage';
import NotFound from './pages/NotFound';
import Comments from './pages/Comments';

import AdminVotingDashboard from './pages/AdminVotingDashboard';
import BrotherVotingPage from './pages/BrotherVotingPage';
import AdminSorting from './pages/AdminSorting';
import BidCommitteeSorting from './pages/BidCommitteeSorting';
import BrotherSorting from './pages/BrotherSorting';

// Render application routes and the contact footer when midterm mode is off.
function AppInner() {
  const { isMidtermMode } = useMidtermMode();

  return (
    <>
      <Routes>
        <Route path='/' element={<Home />} index />
        <Route path='/register' element={<Register />} />
        <Route path='/login' element={<Login />} />
        <Route path='/create-account' element={<CreateAccount />} />
        <Route path='/forgot-password' element={<ForgotPassword />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/bid-committee' element={<BidCommitteeDashboard />} />
        <Route path='/brother/rushee/:gtid' element={<RusheeZoom />} />
        <Route path='/error/:title/:description' element={<MyError />} />
        <Route path='/admin' element={<Admin />} />
        <Route path='/addtimeslotpage' element={<AddTimeslotPage />} />
        <Route path='/rushee/:gtid/:link' element={<RusheePage />} />
        <Route path='/pis/:gtid' element={<Pis />} />
        <Route path='/attendance' element={<Attendance />} />
        <Route path='/comments' element={<Comments />} />
        <Route path='/my-pis' element={<MyPisPage />} />
        <Route path='*' element={<NotFound />} />
        <Route path='/admin/addpis' element={<AddPis />} />
        <Route path='/admin/voting' element={<AdminVotingDashboard />} />
        <Route path='/admin/sorting' element={<AdminSorting />} />
        <Route path='/bidcom/sorting' element={<BidCommitteeSorting />} />
        <Route path='/sorting' element={<BrotherSorting />} />
        <Route path='/voting' element={<BrotherVotingPage />} />
      </Routes>
      {!isMidtermMode && (
        <div className='fixed z-20 bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-apple-gray-200 text-center py-3'>
          <p className='text-apple-footnote text-apple-gray-600 font-light'>
            Contact us at{' '}
            <a
              href='mailto:gavinchen@gatech.edu'
              className='text-black font-normal hover:text-apple-gray-600 transition-colors duration-200 no-underline hover:underline'
            >
              gavinchen@gatech.edu
            </a>
            {' '}or{' '}
            <a
              href='mailto:svuduta6@gatech.edu'
              className='text-black font-normal hover:text-apple-gray-600 transition-colors duration-200 no-underline hover:underline'
            >
              svuduta6@gatech.edu
            </a>
          </p>
        </div>
      )}
    </>
  );
}

// Provide routing, shared midterm state, and toast notifications for the app.
function App() {
  return (
    <div className='m-0 p-0 h-screen w-screen overflow-y-scroll no-scrollbar'>
      <BrowserRouter>
        <MidtermModeProvider>
          <AppInner />
        </MidtermModeProvider>
      </BrowserRouter>
      <ToastContainer
        position='top-center'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme='colored'
      />
    </div>
  );
}

export default App;
