require( 'dotenv' ).config();
const express = require( 'express' );
const cors = require( 'cors' );
const jwt = require( 'jsonwebtoken' )
const cookieParser = require( 'cookie-parser' )

const port = process.env.PORT || 5000;
const app = express();

app.use(
  cors( {
    origin: [ 'http://localhost:5173',
      'https://fast-5d49b.web.app',
      'https://fast-5d49b.firebaseapp.com' ],
    methods: [ "GET", "POST", "PUT", "DELETE", "OPTIONS" ],
    allowedHeaders: [ "Content-Type", "Authorization" ],
    credentials: true
  } )
);
app.use( express.json() )
app.use( cookieParser() )



const { MongoClient, ServerApiVersion, ObjectId } = require( 'mongodb' );
const uri = `mongodb+srv://${ process.env.FAST_ID }:${ process.env.PASSWORD }@cluster0.j5xue.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient( uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
} );

const verifyJWT = ( req, res, next ) =>
{

  const token = req.cookies.Token;
  // console.log('token', token)
  if ( !token )
  {
    return res.status( 401 ).send( { message: "unAuthorized access 40" } )
  }
  jwt.verify( token, process.env.JWT_SECRET_KEY, ( err, decoded ) =>
  {
    if ( err )
    {
      return res.status( 401 ).send( { message: "unAuthorized access 44" } )
    }
    // console.log('decoded result is ', decoded)
    req.user = decoded;
    next()
  } )
}
async function run ()
{
  try
  {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const fast = client.db( 'Fast' );
    const users = fast.collection( 'Users' );
    const marathon = fast.collection( 'marathons' );
    const applicationCollection = fast.collection( 'applications' );
    const upcomingMarathon = fast.collection( 'upcomingMarathon' );

    app.post( '/jwt', ( req, res ) =>
    {
      const email = req.body;
      // console.log(email)
      const token = jwt.sign( email, process.env.JWT_SECRET_KEY, { expiresIn: '2h' } )
      // console.log('your jwt token is - ',token)

      res.cookie( 'Token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      } )
        .send( { message: 'token creat success' } )
    } )
    app.post( '/logout', ( req, res ) =>
    {
      res.clearCookie( 'Token', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      } ).send( { message: 'logout Success' } )
    } )

    app.get( '/users', async ( req, res ) =>
    {
      const Users = await users.find().toArray();
      res.send( Users )
    } )
    app.get( '/marathons', verifyJWT, async ( req, res ) =>
    {
      const email = req.query.email;
      const title = req.query.title;
      if ( email )
      {
        // this code for my application page
        if ( req.user?.email !== email )
        {
          return res.status( 401 ).send( { message: "unAuthorized access 94 " } )
        }
        const myApplications = await applicationCollection.find( { Email: email } ).toArray();
        if ( myApplications.length > 0 )
        {
          const Fields = [];
          for ( const application of myApplications )
          {
            let query = { _id: new ObjectId( application.field_Id ) };
            if ( title )
            {
              query.Title = { $regex: title, $options: 'i' };
            }
            const Field = await marathon.findOne( query );
            if ( Field )
            {
              Fields.push( Field );
            }
          }
          return res.send( Fields );
        }
        res.send( [] );
      }
      else
      {
        // this code for marathon page
        const n = await marathon.countDocuments()
        const Marathon = await marathon.aggregate( [ { $sample: { size: n } } ] ).toArray();
        res.send( Marathon );
      }

    } );
    //show all marathon in dataBase
    app.get( '/marathons/home', async ( req, res ) =>
    {
      const Marathon = await marathon.find().limit( 6 ).toArray();
      res.send( Marathon )
    } )
    app.get( '/all-marathons', async ( req, res ) =>
    {
      const n = await marathon.countDocuments()
      const Marathon = await marathon.aggregate( [ { $sample: { size: n } } ] ).toArray();
      res.send( Marathon );
    } )
    app.get( '/upcoming-marathon', async ( req, res ) =>
    {
      const upMarathon = await upcomingMarathon.aggregate( [ { $sample: { size: 6 } } ] ).toArray();

      res.send( upMarathon )
    } )




    app.get( '/my-application/:id', async ( req, res ) =>
    {
      const ID = req.params.id;
      const query = { field_Id: ID };
      const result = await applicationCollection.findOne( query );
      res.send( result )
    } )
    // show all marathon by user email 
    app.get( '/my-marathon', async ( req, res ) =>
    {
      const email = req.query.email;
      const query = { Email: email }
      const retriveData = await marathon.find( query ).toArray();
      res.send( retriveData )
    } )

    // show a specific  application to update data by Applicant
    app.get( '/marathons/:id', async ( req, res ) =>
    {
      const ID = req.params.id;
      const query = { _id: new ObjectId( ID ) };
      const queryResult = await marathon.findOne( query );
      res.send( queryResult )
    } )



    // create a new user after registration or google login
    app.post( '/users', async ( req, res ) =>
    {
      const data = req.body;
      const userInfo = { UserName: data.Name, Mail: data.Email, Image: data.ProfilePic, Date: data.date }
      const result = await users.insertOne( userInfo )
      res.send( result )
    } )
    // create a new marathon by marathon creator
    app.post( '/add-marathon', async ( req, res ) =>
    {
      const data = req.body;
      const marathonInfo = {
        Title: data.marathonTitle, startDate: data.startDate, endDate: data.endDate, marathonDate: data.marathonDate, currentData: data.CurrentDate, currentTime: data.CurrentTime, Location: data.location, Details: data.details, thumbnail: data.file, TotalReg: data.totalReg,
        Email: data.creatorEmail,
      }
      const result = await marathon.insertOne( marathonInfo )
      res.send( result )
    } )


    // delete a marathon by its creator and find that marathon by its ID
    app.delete( '/delete-marathon/:id', async ( req, res ) =>
    {
      const id = req.params.id;
      const query = { _id: new ObjectId( id ) };
      const result = await marathon.deleteOne( query )
      res.send( result )
    } )

    app.put( '/update-marathon/:id', async ( req, res ) =>
    {
      const id = req.params.id;
      const fieldData = req.body;
      const query = { _id: new ObjectId( id ) };
      const doc = {
        $set: {
          Title: fieldData.marathonTitle, startDate: fieldData.startDate, endDate: fieldData.endDate, marathonDate: fieldData.marathonDate, Details: fieldData.details, thumbnail: fieldData.file
        },
      }
      const result = await marathon.updateOne( query, doc, )
      res.send( result )
    }
    )
    // update a application by patch operation by its own Applicant
    app.patch( '/my-applicatio-update/:id', async ( req, res ) =>
    {
      const Id = req.params.id;
      const data = req.body;

      const query = { field_Id: Id };

      // console.log(query); 

      const updatedDoc = {
        $set: {
          Name: data.Name,
          Gender: data.Gender,
          Blood: data.Blood,
          Phone: data.Phone,
        }
      };

      try
      {
        const result = await applicationCollection.updateOne( query, updatedDoc );
        if ( result.modifiedCount > 0 )
        {
          res.send( { success: true, message: "Update successful", result } );
        } else
        {
          res.send( { success: false, message: "No changes made" } );
        }
      } catch ( error )
      {
        // console.error( "Error updating application:", error );
        res.status( 500 ).send( { error: "Update failed" } );
      }
    } );

    app.post( '/apply-marathon', async ( req, res ) =>
    {
      const data = req.body;
      const result = await applicationCollection.insertOne( data )
      const field_id = data.field_Id;

      const Marathon = await marathon.findOne( { _id: new ObjectId( field_id ) } )
      const totalRegistration = Marathon.TotalReg;
      const updatedDoc = {
        $set: {
          TotalReg: totalRegistration + 1
        }
      }
      const updateMarathon = await marathon.updateOne( { _id: new ObjectId( field_id ) }, updatedDoc )

      res.send( result )
    } )

    app.delete( '/my-application/:id', async ( req, res ) =>
    {
      const Id = req.params.id;
      const query = { field_Id: Id };
      const result = await applicationCollection.deleteOne( query );
      res.send( result )
    } )

    app.listen( port, () =>
    {
      // console.log( port, ' is your port' )
    } )

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log( "Pinged your deployment. You successfully connected to MongoDB!" );
  } finally
  {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run()
  .catch( console.dir );
