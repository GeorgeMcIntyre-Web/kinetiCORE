# Cloud Deployment Strategy - JT to OBJ Conversion Service

## Overview

Deploy JT → OBJ conversion as a serverless cloud function accessible from kinetiCORE web app.

## Architecture Options

### Option 1: Cloudflare Workers (Recommended for kinetiCORE)

**Pros:**
- Already using Cloudflare Pages for kinetiCORE
- Integrated billing
- Global edge network
- 10ms CPU time on free tier

**Cons:**
- No native .NET support (Workers use V8 JavaScript/WASM)
- Would need to rewrite converters in JavaScript/WASM

**Status:** ❌ Not viable - requires complete rewrite

### Option 2: AWS Lambda with .NET Runtime (RECOMMENDED)

**Pros:**
- Native .NET support (.NET 8 runtime)
- Can run existing C# code with minimal changes
- 1M free requests/month
- Pay per execution
- Integrates with S3 for file storage

**Cons:**
- Separate AWS account needed
- Cold start latency (~1-2s)
- 15-minute execution limit

**Status:** ✅ RECOMMENDED - Best fit for C# converters

### Option 3: Azure Functions (.NET)

**Pros:**
- Native Microsoft .NET support
- Good for .NET workloads
- Consumption plan available

**Cons:**
- More expensive than AWS Lambda
- Less popular for side projects

**Status:** ⚠️ Alternative to AWS Lambda

### Option 4: Docker Container on Cloud Run (Google)

**Pros:**
- Can package entire converter with all DLLs
- No runtime constraints
- Auto-scales to zero

**Cons:**
- Larger cold starts
- More expensive
- Overkill for simple conversion

**Status:** ⚠️ Backup option

## Recommended Solution: AWS Lambda + S3

### Architecture

```
Client (Browser)
    ↓
1. Upload JT file to S3 (pre-signed URL)
    ↓
2. Trigger Lambda function
    ↓
3. Lambda: JT → OBJX → OBJ
    ↓
4. Save OBJ/MTL to S3
    ↓
5. Return download URLs to client
    ↓
Client downloads OBJ/MTL files
```

### Implementation Steps

#### 1. Package Lambda Function

```bash
# Create Lambda deployment package
dotnet publish -c Release -r linux-x64 --self-contained
zip -r lambda.zip . -i '*.dll' '*.exe' '*.so'
```

#### 2. Lambda Handler (C#)

```csharp
using Amazon.Lambda.Core;
using Amazon.Lambda.S3Events;
using Amazon.S3;
using Amazon.S3.Model;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

public class ConversionHandler
{
    private IAmazonS3 _s3Client = new AmazonS3Client();

    public async Task<string> FunctionHandler(S3Event s3Event, ILambdaContext context)
    {
        var bucket = s3Event.Records[0].S3.Bucket.Name;
        var key = s3Event.Records[0].S3.Object.Key;

        // Download JT file from S3
        var jtFile = await DownloadFromS3(bucket, key);

        // Convert JT → OBJX
        var objxFile = ConvertJTtoOBJX(jtFile);

        // Convert OBJX → OBJ
        var (objFile, mtlFile) = ConvertOBJXtoOBJ(objxFile);

        // Upload results to S3
        var objKey = await UploadToS3(bucket, $"output/{Path.GetFileNameWithoutExtension(key)}.obj", objFile);
        var mtlKey = await UploadToS3(bucket, $"output/{Path.GetFileNameWithoutExtension(key)}.mtl", mtlFile);

        return $"Success: {objKey}, {mtlKey}";
    }
}
```

#### 3. Frontend Integration

```typescript
// In kinetiCORE frontend
async function convertJTFile(file: File) {
  // 1. Get pre-signed upload URL from your API
  const uploadUrl = await fetch('/api/get-upload-url').then(r => r.json());

  // 2. Upload JT file to S3
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file
  });

  // 3. Trigger conversion (Lambda auto-triggers on S3 upload)
  // or explicitly call Lambda via API Gateway

  // 4. Poll for results
  const interval = setInterval(async () => {
    const status = await fetch(`/api/conversion-status/${file.name}`).then(r => r.json());
    if (status.complete) {
      clearInterval(interval);
      // Download OBJ file
      const objUrl = status.objUrl;
      loadOBJFile(objUrl);
    }
  }, 2000);
}
```

### Cost Estimate (AWS Lambda + S3)

**Assumptions:**
- 1,000 conversions/month
- Average file: 5MB JT → 10MB OBJ
- Lambda runtime: 10 seconds per conversion

**Costs:**
- Lambda: 1,000 requests × 10s × $0.0000166667/GB-second = $0.17/month
- S3 storage: 15GB × $0.023/GB = $0.35/month
- S3 transfer: 10GB × $0.09/GB = $0.90/month

**Total:** ~$1.42/month (well within free tier for first year)

## Simpler Alternative: Client-Side Conversion

### Using WebAssembly (WASM)

**Concept:** Compile C# converters to WASM, run in browser

**Pros:**
- No server costs
- Instant execution
- Works offline
- Privacy (files never leave browser)

**Cons:**
- Large WASM bundle size
- Slower than native
- Complex build setup

**Implementation:**
1. Use Uno Platform or Blazor WASM
2. Compile OBJXtoOBJ.cs to WASM
3. Load WASM module in browser
4. Process files client-side

**Status:** 🔬 Experimental - worth exploring

## Recommended Deployment Path

### Phase 1: Local Tool (CURRENT)
- ✅ Desktop converter works
- User manually converts files
- No cloud costs

### Phase 2: Cloud Function (Next)
- Deploy to AWS Lambda
- S3 for file storage
- API Gateway for HTTP endpoint

### Phase 3: WASM Client-Side (Future)
- Compile to WebAssembly
- Eliminate server dependency
- Instant conversion in browser

## Implementation Priority

**For Essential Layout integration:**

1. **Short-term (Now)**: User uploads pre-converted OBJ files
   - Agent 3 implements OBJ file picker
   - User manually converts JT → OBJ offline
   - Upload OBJ directly to kinetiCORE

2. **Medium-term (Later)**: Cloud conversion service
   - Deploy Lambda function
   - Add "Convert JT" button to UI
   - Automatic server-side conversion

3. **Long-term (Future)**: Client-side WASM
   - Compile to WebAssembly
   - In-browser conversion
   - No server needed

## Deployment Checklist

### AWS Lambda Deployment

- [ ] Create AWS account
- [ ] Set up S3 bucket (`kineticore-conversions`)
- [ ] Package Lambda function with DLLs
- [ ] Deploy Lambda with .NET 8 runtime
- [ ] Configure S3 trigger
- [ ] Set up API Gateway
- [ ] Add CORS headers
- [ ] Test with sample JT file
- [ ] Integrate with kinetiCORE frontend
- [ ] Monitor costs and performance

### Security Considerations

- **Input validation**: Check file size limits (max 50MB)
- **Virus scanning**: Scan uploaded files
- **Rate limiting**: Prevent abuse
- **Authentication**: Require API key
- **Encryption**: Use HTTPS/S3 encryption

## Resources

- **AWS Lambda .NET**: https://docs.aws.amazon.com/lambda/latest/dg/csharp-package.html
- **S3 Pre-signed URLs**: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- **Blazor WASM**: https://dotnet.microsoft.com/apps/aspnet/web-apps/blazor

## Current Status

- ✅ Local converters working
- ✅ Deployment package ready (`deploy/` folder)
- ❌ Cloud deployment not yet implemented
- ❌ WASM compilation not attempted

**Recommendation:** Start with Phase 1 (manual conversion). Deploy Phase 2 (Lambda) only if high usage justifies cloud costs.

---

**For immediate Essential Layout integration: Skip cloud deployment. Use pre-converted OBJ files.**
