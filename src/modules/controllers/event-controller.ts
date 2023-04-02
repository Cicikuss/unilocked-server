import { Router } from "express";
import BaseController from "./base-controller";
import { EventModel } from "@models/event";
import success from "@modules/responses/success";
import PaginateService from "@modules/services/paginate";
import mongoose from "mongoose";
import { UserModel } from "@models/user";
import { OID } from "@modules/helpers/generate-object-id";
import { UniversityModel } from "@models/university";

export class EventController extends BaseController {
    listen(router: Router): void {
        //Get events
        router.get("/", async (req, res, next) => {
            const events = EventModel.find();

            res.send(success(await PaginateService.paginate(req, EventModel, events)));
            next();
        });

        //Get event by ID
        router.get("/:id", async (req, res, next) => {
            const event = await this.byIdExpanded(req.params.id);

            res.send({
                success: true,
                data: event
            });
            next();
        });

        //Create new event
        router.post("/create", async (req, res, next) => {
            const event = await this.createEvent(
                req.user._id,
                req.body.event
            );

            res.send({
                success: true,
                data: event
            });
            next();
        });

        //Edit an existing event
        router.put(":id/edit", async (req, res, next) => {
            const event = await this.editEvent(
                req.user._id,
                req.params.id,
                req.body.event
            );

            res.send({
                success: true,
                data: event
            });
            next();
        });

        //Delete an event
        router.delete(":id/delete", async (req, res, next) => {
            const event = await this.deleteEvent(req.user._id, req.params.id);

            res.send({
                success: true,
                data: event
            });
            next();
        });

        //Participate in an event
        router.post(":id/participate", async (req, res, next) => {
            const event = await this.participate(req.user._id, req.params.id);

            res.send({
                success: true,
                data: event
            });
            next();
        });

        //Leave an event
        router.post(":id/leave", async (req, res, next) => {
            const event = await this.leave(req.user._id, req.params.id);

            res.send({
                success: true,
                data: event
            });
            next();
        });

        //List the participants of the event
        router.get(":id/participants", async (req, res, next) => {
            const participants = await this.participants(req.params.id);

            res.send({
                success: true,
                data: participants
            });
            next();
        });
    }

    public byId(_id: string) {
        return EventModel.findOne({ _id: new mongoose.Types.ObjectId(_id) });
    }

    //Same with the byId, except this method's result contain some information about creator and organizators.
    public byIdExpanded(_id: string) {
        return EventModel.findOne({ _id: new mongoose.Types.ObjectId(_id) }).populate([
            { path: 'creator', select: ['username', 'first_name', 'last_name'] },
            { path: 'organizator', select: ['name', 'icon_url'] }
        ]).exec();
    }

    public async createEvent(userID, event) {
        const eventModel = new EventModel({
            name: event.name,
            description: event.description,
            creator: userID,
            organizator: event.organizatorID,
            eventDate: event.eventDate,
            location: event.location,
        });
        const savedEvent = await eventModel.save(); //Save the event to the DB.

        //Add the event to the events that the user participates in.
        UserModel.updateOne(
            {_id: OID(userID)},
            { $push: { createdEvents: savedEvent._id }}
        );

        //Add the event to the events that the university arrange.
        UniversityModel.updateOne(
            { _id: savedEvent.organizator },
            { $push: { events: savedEvent._id}}
        );

        return savedEvent;
    }

    public async editEvent(userID, eventID: string, newEvent) {
        const existingEvent = await this.byId(eventID);
        const creator = existingEvent.creator;
        if (creator._id != userID)
            throw new Error("Only the creator is allowed to edit the event.");
        
        existingEvent.name = newEvent.name;
        existingEvent.description = newEvent.description;
        existingEvent.creator = existingEvent.creator;
        existingEvent.organizator = newEvent.organizatorID;
        existingEvent.eventDate = newEvent.eventDate;
        existingEvent.location = newEvent.location;

        const updatedEvent = await existingEvent.save();
        return updatedEvent;
    }

    public async deleteEvent(userID, eventID) {
        const event = await this.byId(eventID);
        const creator = event.creator;
        if (creator != userID)
            throw new Error("Only the creator is allowed to delete the event.");
        
        //Delete the event from the participants' participatedEvents fields.
        const participants = event.participants;
        participants.forEach(async participant => {
            await UserModel.updateOne({ _id: participant },
                { $pull: { participatedEvents: OID(eventID) } })
        });

        //Delete the event from the creator's createdEvent field.
        await UserModel.updateOne({ _id: creator },
            { $pull: { createdEvents: OID(eventID) } }
        );
        
        //Delete the event from the universities' events fields.
        await UniversityModel.updateOne(
            { _id: event.organizator },
            { $pull: { events: event._id}}
        );
        
        await event.remove(); //Delete the event from the DB.
        return event;
    }

    public async participate(userID, eventID) {
        const event = await this.byId(eventID);
        if (event.participants.includes(OID(userID)))
            return event; //Already participated.
        
        //Add the event to the participatedEvents field of the participant.
        await UserModel.updateOne({ _id: userID },
            {  $push: { participatedEvents: event._id }}
        );

        //Add the participant to the participants field of the event.
        await EventModel.updateOne({ _id: event._id },
            { $push: { participants: OID(userID) } }
        );

        return event;
    }

    public async leave(userID, eventID) {
        const event = await this.byId(eventID);
        if (!event.participants.includes(OID(userID)))
            throw new Error("User is not a participant.");
        
        //Remove the event from the participatedEvents field of the participant.
        await UserModel.updateOne({ _id: userID },
            { $pull: { participatedEvents: event._id }}
        );

        //Remove the participant from the participants field of the event.
        await EventModel.updateOne({ _id: event._id },
            { $pull: { participants: OID(userID) } }
        );

        return event;
    }

    public async participants(eventID) {
        return EventModel.findOne({ _id: OID(eventID) }).select('participants').populate({
            path: 'participants',
            select: ['username', 'first_name', 'last_name', 'avatar_url']
        }).exec();
    }
}