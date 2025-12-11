# 🎯 Action Plan: Complete NCP SMS Setup

**Goal**: Get your SMS notifications working with NCP SENS  
**Time Required**: ~15-20 minutes  
**Current Status**: Code is ready, needs configuration

---

## 📋 Step-by-Step Action Plan

### ✅ Already Done (By Me)

- [x] Updated `lib/sms.ts` to use NCP SENS API
- [x] Removed Twilio from `package.json`
- [x] Implemented HMAC SHA256 authentication
- [x] Added Korean phone number validation
- [x] Added auto SMS/LMS detection
- [x] Created comprehensive documentation

### 🎯 Your Tasks (Do These Next)

---

## STEP 1: Create NCP Account (5 minutes)

**Reference**: `NCP_SMS_SETUP.md` (Section 1-2)

1. Go to https://console.ncloud.com/
2. Click **회원가입** (Sign Up)
3. Complete registration (requires Korean phone for verification)
4. Verify email
5. Log in to NCP Console
6. Go to **Services** → **AI·NAVER API** → **SENS**
7. Click **이용 신청** (Apply for Service)
8. Accept terms and conditions

**What you need**: Korean phone number for verification

---

## STEP 2: Create SMS Project (3 minutes)

**Reference**: `NCP_SMS_SETUP.md` (Section 3)

1. In SENS Dashboard, click **SMS** tab
2. Click **프로젝트 생성** (Create Project)
3. Enter project name: `FashionSearch` (or any name)
4. Click **생성** (Create)
5. **IMPORTANT**: Copy the **Service ID** (looks like `ncp:sms:kr:123456789012:project-name`)
   - Save this for Step 4

**What you get**: Service ID for environment variables

---

## STEP 3: Register Sender Number (5 minutes)

**Reference**: `NCP_SMS_SETUP.md` (Section 4)

1. In your SMS project, go to **발신번호 관리** (Sender Number Management)
2. Click **발신번호 등록** (Register Sender Number)
3. Enter your Korean phone number (format: `01012345678`)
4. Choose **ARS 인증** (ARS verification) for instant approval
5. Answer the phone call and follow instructions
6. Wait for approval status: **승인 완료** (Approved)

**What you need**: Korean phone number to use as sender  
**What you get**: Verified sender number

---

## STEP 4: Get API Credentials (2 minutes)

**Reference**: `NCP_SMS_SETUP.md` (Section 5)

1. In NCP Console, click your profile (top right)
2. Go to **My Page** → **계정 관리** → **인증키 관리** (API Key Management)
3. Click **API 인증키 관리** (API Key Management)
4. If no keys exist, click **신규 API 인증키 생성** (Create New API Key)
5. **IMPORTANT**: Copy these values:
   - **Access Key ID**: `eGFtcGxlQWNjZXNzS2V5...`
   - **Secret Key**: Click "show" to reveal, then copy

**What you get**: Access Key and Secret Key for environment variables

---

## STEP 5: Update Environment Variables (2 minutes)

**Reference**: `NCP_SMS_SETUP.md` (Section 6)

1. Open `.env.local` in your project root
2. **Remove or comment out** old Twilio variables:
   ```bash
   # TWILIO_ACCOUNT_SID=...
   # TWILIO_AUTH_TOKEN=...
   # TWILIO_PHONE_NUMBER=...
   ```

3. **Add** new NCP variables:
   ```bash
   # NCP SMS Configuration
   NCP_ACCESS_KEY=your_access_key_from_step_4
   NCP_SECRET_KEY=your_secret_key_from_step_4
   NCP_SMS_SERVICE_ID=your_service_id_from_step_2
   NCP_FROM_NUMBER=01012345678
   
   # Keep existing
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

4. Save the file

**Example** (with real values):
```bash
NCP_ACCESS_KEY=eGFtcGxlQWNjZXNzS2V5
NCP_SECRET_KEY=eGFtcGxlU2VjcmV0S2V5MTIzNDU2Nzg=
NCP_SMS_SERVICE_ID=ncp:sms:kr:123456789012:fashionsearch
NCP_FROM_NUMBER=01012345678
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## STEP 6: Clean Dependencies (1 minute)

**Reference**: `TWILIO_TO_NCP_MIGRATION.md` (Section 3)

Run these commands in your terminal:

```bash
# Remove Twilio
npm uninstall twilio

# Reinstall dependencies
npm install
```

**Expected output**:
```
removed 1 package
...
added 0 packages
```

---

## STEP 7: Restart Development Server (1 minute)

```bash
# Stop current server (Ctrl+C if running)
# Start server
npm run dev
```

**What to look for**:
- No errors about missing Twilio
- Server starts successfully on http://localhost:3000

---

## STEP 8: Test SMS Functionality (3 minutes)

**Reference**: `NCP_SMS_SETUP.md` (Section: Testing)

1. Open http://localhost:3000
2. Upload a fashion image
3. Select items to search
4. Enter your Korean phone number: `010-1234-5678`
5. Click search button
6. Check terminal for logs:
   ```
   🚀 Created search job job_xxx with SMS notification
   ⚙️ Processing job job_xxx...
   📱 Sending SMS to 01012345678
   📨 Message type: SMS (or LMS)
   ✅ SMS sent successfully. Request ID: 12345...
   ```
7. Wait 1-2 minutes for SMS on your phone
8. SMS should say:
   ```
   ✨ Your fashion search is ready! View your results here: http://localhost:3000/search-results/job_xxx
   ```
9. Click the link in SMS
10. Verify results page loads correctly

**If successful**: ✅ You're done!  
**If issues**: See Step 9 (Troubleshooting)

---

## STEP 9: Troubleshooting (If Needed)

### Issue 1: "NCP SMS credentials not configured"

**Check**:
```bash
# In terminal, verify env vars are set:
cat .env.local | grep NCP
```

**Should show**:
```
NCP_ACCESS_KEY=...
NCP_SECRET_KEY=...
NCP_SMS_SERVICE_ID=...
NCP_FROM_NUMBER=...
```

**Fix**: If missing, add them and restart server

---

### Issue 2: Terminal shows "Status: 403"

**Cause**: Sender number not approved

**Fix**:
1. Go to NCP Console → SENS → Your Project
2. Check **발신번호 관리** (Sender Number Management)
3. Verify status is **승인 완료** (Approved), not **대기중** (Pending)
4. If pending, complete verification process

---

### Issue 3: Terminal shows "Status: 401"

**Cause**: Invalid API credentials

**Fix**:
1. Verify Access Key and Secret Key in `.env.local`
2. Check for typos or extra spaces
3. Regenerate keys in NCP Console if needed
4. Update `.env.local` and restart

---

### Issue 4: "Invalid phone number format"

**Cause**: Phone number format incorrect

**Fix**: Use one of these formats:
- `010-1234-5678` ✅
- `01012345678` ✅
- `+821012345678` ✅

Not:
- `1234567890` ❌
- `821234567890` ❌

---

### Issue 5: SMS not received

**Check**:
1. Terminal logs show "SMS sent successfully"
2. NCP Console → SENS → Your Project → **발송 내역** (Send History)
3. Verify phone number is correct
4. Check spam folder (some carriers filter automated messages)

**Wait**: SMS can take up to 1-2 minutes in rare cases

---

## 📊 Verification Checklist

After completing all steps, verify:

- [ ] NCP account created
- [ ] SENS service enabled
- [ ] SMS project created
- [ ] Sender number registered and **approved**
- [ ] API credentials obtained
- [ ] `.env.local` updated with 4 NCP variables
- [ ] Old Twilio variables removed/commented
- [ ] Twilio uninstalled (`npm uninstall twilio`)
- [ ] Dependencies reinstalled (`npm install`)
- [ ] Dev server restarted successfully
- [ ] No console errors on startup
- [ ] Test image uploaded
- [ ] Phone number entered
- [ ] Terminal shows "SMS sent successfully"
- [ ] SMS received on phone
- [ ] Link in SMS works
- [ ] Results page displays correctly

---

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Terminal shows:
   ```
   📱 Sending SMS to 01012345678
   📨 Message type: SMS
   ✅ SMS sent successfully. Request ID: abc123
   ```

2. ✅ Phone receives SMS:
   ```
   ✨ Your fashion search is ready! View your results here: http://localhost:3000/search-results/job_xxx
   ```

3. ✅ Clicking link shows results

4. ✅ No errors in terminal or browser console

---

## 🚀 Production Deployment (Later)

When ready to deploy to production:

**Reference**: `NCP_SMS_SETUP.md` (Section: Production Deployment)

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the same 4 NCP variables
3. **Update** `NEXT_PUBLIC_BASE_URL` to your production domain:
   ```
   NEXT_PUBLIC_BASE_URL=https://yourdomain.com
   ```
4. Deploy
5. Test with real phone number

---

## 📚 Documentation Reference

If you get stuck, refer to these docs:

1. **Setup Guide**: `NCP_SMS_SETUP.md` - Detailed setup instructions
2. **Migration Guide**: `TWILIO_TO_NCP_MIGRATION.md` - Comparison and migration details
3. **Quick Reference**: `NCP_SMS_REFERENCE.md` - Code examples and API reference
4. **Summary**: `SMS_MIGRATION_SUMMARY.md` - What changed overview
5. **This File**: `ACTION_PLAN_NCP_SMS.md` - Step-by-step action plan

---

## ⏱️ Time Estimate

| Step | Time | Difficulty |
|------|------|------------|
| 1. NCP Account | 5 min | Easy |
| 2. SMS Project | 3 min | Easy |
| 3. Sender Number | 5 min | Medium (phone verification) |
| 4. API Credentials | 2 min | Easy |
| 5. Env Variables | 2 min | Easy |
| 6. Dependencies | 1 min | Easy |
| 7. Restart Server | 1 min | Easy |
| 8. Test | 3 min | Easy |
| **Total** | **~20 min** | **Easy-Medium** |

---

## 💡 Pro Tips

1. **Save credentials securely**: Store Access Key and Secret Key in password manager
2. **Test immediately**: Don't wait to test - easier to debug fresh setup
3. **Check NCP console**: Use send history to verify delivery
4. **Korean vs English**: Korean messages are more byte-efficient (cheaper)
5. **URL shortener**: Consider using bit.ly to reduce message length
6. **Multiple projects**: You can create separate SENS projects for dev/staging/prod

---

## 🎯 Next Actions (In Order)

```
1. Open: https://console.ncloud.com/
2. Create account & enable SENS
3. Create SMS project → Get Service ID
4. Register sender number → Get approved
5. Get API credentials → Copy Access Key + Secret Key
6. Update .env.local → Add 4 NCP variables
7. Run: npm uninstall twilio && npm install
8. Run: npm run dev
9. Test: Upload image → Enter phone → Check SMS
10. Celebrate! 🎉
```

---

## ❓ Questions?

- **Setup issues**: Check `NCP_SMS_SETUP.md`
- **Code questions**: Check `NCP_SMS_REFERENCE.md`
- **Comparison**: Check `TWILIO_TO_NCP_MIGRATION.md`
- **What changed**: Check `SMS_MIGRATION_SUMMARY.md`

---

**Ready?** Start with Step 1 above! ⬆️

**Current Status**: ✅ Code ready, waiting for your NCP configuration

**Estimated Time to Complete**: ~20 minutes

---

Good luck! You've got this! 💪📱

