// Utility function to completely reset all processing states
// Add this to browser console if you get stuck

function emergencyReset() {
    console.log('🚨 Emergency reset initiated...');
    
    // Clear all browser storage
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
        console.log('✅ Session storage cleared');
    }
    
    if (typeof localStorage !== 'undefined') {
        localStorage.clear();
        console.log('✅ Local storage cleared');
    }
    
    // Clear all cookies
    document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    console.log('✅ Cookies cleared');
    
    console.log('🔄 Reloading page...');
    
    // Reload the page
    window.location.reload();
}

// Export for use
window.emergencyReset = emergencyReset;
console.log('🛠️ Emergency reset function loaded. Run emergencyReset() if you get stuck.');