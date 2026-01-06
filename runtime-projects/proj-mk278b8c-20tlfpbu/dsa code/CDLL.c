#include<stdio.h>
#include<stdlib.h>
struct Node{
    int info;
    struct Node* prev;
    struct Node* next;
};
struct Node* create_cdll(struct Node* start){
    struct Node*new,*ptr;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to create the node ..");
        scanf("%d",&item);
        new->info=item;
        start=new;
        new->prev=start;
        new->next=start;
    }
    return (start);
}
void traverse(struct Node * start){
    if(start==NULL){
        printf("OVERFLOW");
    }
    else{
        struct Node* ptr=start;
        printf("CDLL contains ...");
        printf("%d\t",ptr->info);
        ptr=ptr->next;
        while(ptr!=start){
            printf("%d\t",ptr->info);
            ptr=ptr->next;
        }
    }

}
struct Node* insert_beg(struct Node* start){
    struct Node* new,*ptr;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be inserted");
        scanf("%d",&item);
        new->info=item;
        new->next=NULL;
        new->prev=NULL;
        if(start==NULL){
            start=new;
        }
        else{
            ptr=start->prev;
            ptr->next=new;
            new->prev=ptr;
            new->next=start;
            start->prev=new;
            start=new;
        }
    }
    return(start);
}
struct Node* insert_end(struct Node* start){
    struct Node*new,*ptr;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
        printf("enter item to be inserted");
        scanf("%d",&item);
        new->info=item;
        new->next=NULL;
        new->prev=NULL;
        if(start==NULL){
            start=new;
        }
        else{
            ptr=start->prev;
            ptr->next=new;
            new->prev=ptr;
            new->next=start;
            start->prev=new;
        }
    }
    return(start);
}
struct Node* delete_beg(struct Node*start){
    struct Node* ptr;
    if(start==NULL){
        printf("UNDERFLOW");
    }
    else{
        ptr=start;
        printf("deleted item is: %d",ptr->info);
        start=ptr->next;
        ptr->prev->next=ptr->next;
        ptr->next->prev=ptr->prev;
        free(ptr);

    }
    return(start);
}
struct Node* delete_end(struct Node* start){
    struct Node* ptr;
    if(start==NULL){
        printf("OVERFLOW");
    }
    else{
        ptr=start->prev;
        printf("deleted item is:%d",ptr->info);
        ptr->prev->next=start;
        start->prev=ptr->prev;
        free(ptr);
    }
    return(start);
}
int main(){
    struct Node* start=NULL;
    int item,choice;
    start=create_cdll(start);
    do{
        printf("\npress\n1->insert at beg\n2->insert at end\n3->delete at beg\n4->delete at end\n5->traverse\n6->exit\n");
        printf("enter your choice");
        scanf("%d",&choice);
        switch(choice){
            case 1:start=insert_beg(start);
                   traverse(start);
                   break;
            case 2:start=insert_end(start);
                   traverse(start);
                   break;
            case 3:start=delete_beg(start);
                   traverse(start);
                   break;
            case 4:start=delete_end(start);
                   traverse(start);
                   break;
            case 5:traverse(start);
                   break;
            case 6:exit(0);
                   break;
            default:printf("invalid choice");
        }
    }while(choice<7);
}