import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { connectDB } from './mongodb'
import User from '@/models/User'
import { comparePassword } from './auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please provide email and password')
        }

        await connectDB()

        const user = await User.findOne({ email: credentials.email }).select('+password')
        if (!user || !user.password) {
          throw new Error('Invalid email or password')
        }

        const isPasswordValid = await comparePassword(credentials.password, user.password)
        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        return {
          id: String(user._id),
          email: user.email,
          name: user.name,
          image: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        await connectDB()

        const existingUser = await User.findOne({ email: user.email })

        if (!existingUser) {
          await User.create({
            name: user.name,
            email: user.email,
            avatar: user.image,
            provider: 'google',
            providerId: account.providerAccountId,
          })
        } else if (existingUser.provider !== 'google') {
          existingUser.provider = 'google'
          existingUser.providerId = account.providerAccountId
          if (user.image) existingUser.avatar = user.image
          await existingUser.save()
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
}
