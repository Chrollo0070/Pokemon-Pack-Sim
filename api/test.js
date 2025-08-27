export default function handler(request, response) {
  response.status(200).json({ 
    message: 'API endpoint working correctly',
    time: new Date().toISOString()
  });
}