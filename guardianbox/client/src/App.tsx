import { Routes, Route } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import DownloadPage from './pages/DownloadPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/download/:id" element={<DownloadPage />} />
      <Route path="/file/:id" element={<DownloadPage />} />
    </Routes>
  )
}
