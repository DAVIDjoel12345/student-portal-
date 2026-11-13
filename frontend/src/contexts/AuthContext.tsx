import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService } from '../services/api';

interface User { id:number; name:string; username:string; role:'student'|'staff'|'admin'; }
interface AuthContextType { isAuthenticated:boolean; user:User|null; otpPending:boolean; pendingUserId:number|null; error:string; login:(loginId:string,password:string)=>Promise<void>; verifyOtp:(otp:string)=>Promise<boolean>; logout:()=>Promise<void>; clearError:()=>void; }
const AuthContext=createContext<AuthContextType|null>(null);
export const AuthProvider=({children}:{children:ReactNode})=>{
 const [user,setUser]=useState<User|null>(()=>{try{const token=sessionStorage.getItem('token');const expiresAt=Number(sessionStorage.getItem('tokenExpiresAt'));if(!token||!expiresAt||expiresAt<=Date.now()){sessionStorage.clear();return null;}return JSON.parse(sessionStorage.getItem('user')||'null');}catch{sessionStorage.clear();return null;}});
 const [otpPending,setOtpPending]=useState(false);const [pendingUserId,setPendingUserId]=useState<number|null>(null);const [error,setError]=useState('');
 const login=async(loginId:string,password:string)=>{setError('');try{const result=await authService.login({loginId,password});setPendingUserId(result.userId);setOtpPending(true);}catch(e){setError(e instanceof Error?e.message:'Sign in failed');}};
 const verifyOtp=async(otp:string)=>{setError('');if(!pendingUserId){setError('Please sign in again to request a verification code.');setOtpPending(false);return false;}try{const result=await authService.verifyOtp({userId:pendingUserId,otp});const tokenBody=result.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const payload=JSON.parse(window.atob(tokenBody+'='.repeat((4-tokenBody.length%4)%4)));sessionStorage.setItem('token',result.token);sessionStorage.setItem('tokenExpiresAt',String(payload.exp*1000));const nextUser={id:result.user.id,name:result.user.displayName,username:result.user.loginId,role:result.user.role};sessionStorage.setItem('user',JSON.stringify(nextUser));setUser(nextUser);setPendingUserId(null);setOtpPending(false);return true;}catch(e){setError(e instanceof Error?e.message:'Verification failed');return false;}};
 const logout=async()=>{await authService.logout();sessionStorage.removeItem('user');sessionStorage.removeItem('tokenExpiresAt');setUser(null);setPendingUserId(null);setOtpPending(false);setError('');};
 useEffect(()=>{if(!user)return;const remaining=Number(sessionStorage.getItem('tokenExpiresAt'))-Date.now();if(remaining<=0){sessionStorage.clear();setUser(null);return;}const timer=window.setTimeout(()=>{sessionStorage.clear();setUser(null);setPendingUserId(null);setOtpPending(false);},remaining);return()=>window.clearTimeout(timer);},[user]);
 const clearError=()=>setError('');
 return <AuthContext.Provider value={{isAuthenticated:!!user,user,otpPending,pendingUserId,error,login,verifyOtp,logout,clearError}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be within AuthProvider');return value;};
