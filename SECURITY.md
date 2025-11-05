# 🔐 Security Notice

## ⚠️ Important: Secret Leaks in Git History

GitHub has detected MongoDB credentials in the git history of this repository. While these files have been removed from the current codebase, they still exist in previous commits.

### If the leaked credentials were real production secrets:

1. **Immediately rotate the credentials:**
   - Change your MongoDB database password
   - Update the connection string
   - Revoke any compromised API keys

2. **Update environment variables in Vercel:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Update with new credentials

### For future commits:

- ✅ Never commit `.env` or `.env.local` files (already in `.gitignore`)
- ✅ Never include real credentials in markdown documentation
- ✅ Use `.env.example` with placeholder values only
- ✅ Always use environment variables for sensitive data

## Environment Variables for Vercel

This app requires the following environment variables in Vercel:

1. **MONGODB_URI** - MongoDB Atlas connection string
2. **GEMINI_API_KEY** - Google Gemini API key  
3. **JWT_SECRET** - Random secure string for JWT tokens

### How to add in Vercel:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Settings → Environment Variables
4. Add each variable for Production, Preview, and Development

---

**Note:** The git history cannot be easily cleaned without force-pushing, which would affect all collaborators. If this is a concern, consider creating a new repository with a fresh history.
